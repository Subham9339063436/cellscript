#include "evaluator.h"
#include "lexer.h"
#include "parser.h"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <stdexcept>

namespace {
struct Address { int row; int col; };
Address parseAddress(const std::string& s) {
    std::size_t i=0; int col=0;
    while(i<s.size() && std::isalpha(static_cast<unsigned char>(s[i]))) {
        col=col*26+(std::toupper(static_cast<unsigned char>(s[i]))-'A'+1); ++i;
    }
    int row=0;
    while(i<s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) { row=row*10+(s[i]-'0'); ++i; }
    if(i!=s.size() || row<1 || col<1) throw std::runtime_error("Invalid cell reference '"+s+"'");
    return {row,col};
}
std::string cellName(int row,int col) {
    std::string letters;
    while(col>0) { --col; letters.insert(letters.begin(),static_cast<char>('A'+col%26)); col/=26; }
    return letters+std::to_string(row);
}
}

std::string SpreadsheetEvaluator::normalizeCell(const std::string& s) {
    std::string out=s;
    for(char& c:out) c=static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    return out;
}
void SpreadsheetEvaluator::collectDependencies(const ASTPtr& n,std::set<std::string>& deps) {
    if(!n) return;
    switch(n->type) {
      case NodeType::Number: break;
      case NodeType::CellRef: deps.insert(normalizeCell(n->text)); break;
      case NodeType::Range: {
        const auto a=parseAddress(n->rangeStart), b=parseAddress(n->rangeEnd);
        const int r0=std::min(a.row,b.row), r1=std::max(a.row,b.row);
        const int c0=std::min(a.col,b.col), c1=std::max(a.col,b.col);
        if(static_cast<long long>(r1-r0+1)*(c1-c0+1)>100000)
          throw std::runtime_error("Cell range too large (maximum 100000 cells)");
        for(int r=r0;r<=r1;++r) for(int c=c0;c<=c1;++c) deps.insert(cellName(r,c));
        break;
      }
      case NodeType::BinaryOp: collectDependencies(n->left,deps); collectDependencies(n->right,deps); break;
      case NodeType::FuncCall: for(const auto& a:n->args) collectDependencies(a,deps); break;
    }
}
void SpreadsheetEvaluator::visit(const std::string& raw) {
    const std::string cell=normalizeCell(raw);
    if(visitState_[cell]==2) return;
    if(visitState_[cell]==1) {
        auto begin=std::find(stack_.begin(),stack_.end(),cell);
        std::ostringstream chain;
        for(auto it=begin;it!=stack_.end();++it) { if(it!=begin) chain<<" -> "; chain<<*it; }
        chain<<" -> "<<cell;
        const std::string msg="Circular reference detected: "+chain.str();
        for(auto it=begin;it!=stack_.end();++it) errors_[*it]=msg;
        errors_[cell]=msg; return;
    }
    visitState_[cell]=1; stack_.push_back(cell);
    auto it=cells_.find(cell);
    if(it!=cells_.end()) {
      for(const auto& dep:it->second.dependsOn) {
        // Only formula cells participate in graph traversal. Empty cells inside
        // aggregate ranges are valid blanks; direct missing references are diagnosed
        // when the AST evaluator resolves them.
        if(cells_.count(dep)) visit(dep);
      }
    }
    stack_.pop_back(); visitState_[cell]=2; order_.push_back(cell);
}
std::vector<double> SpreadsheetEvaluator::expandRange(const std::string& start,const std::string& end) {
    const auto a=parseAddress(start), b=parseAddress(end);
    const int r0=std::min(a.row,b.row), r1=std::max(a.row,b.row);
    const int c0=std::min(a.col,b.col), c1=std::max(a.col,b.col);
    if(static_cast<long long>(r1-r0+1)*(c1-c0+1)>100000)
      throw std::runtime_error("Cell range too large (maximum 100000 cells)");
    std::vector<double> out;
    for(int r=r0;r<=r1;++r) for(int c=c0;c<=c1;++c) {
      const std::string cell=cellName(r,c);
      // Spreadsheet aggregate functions ignore blank cells. Explicit numeric zeroes
      // are still included because their cell exists in the symbol table/input map.
      if(cells_.count(cell)||inputs_.count(cell)) out.push_back(getCellValue(cell,cell));
    }
    return out;
}
double SpreadsheetEvaluator::getCellValue(const std::string& raw,const std::string& owner) {
    (void)owner;
    const std::string cell=normalizeCell(raw);
    // Errors take precedence over input lookup (for example, a conflicting
    // formula and constant assigned to the same cell).
    auto error=errors_.find(cell);
    if(error!=errors_.end()) throw std::runtime_error(error->second);
    auto input=inputs_.find(cell); if(input!=inputs_.end()) return input->second;
    auto it=cells_.find(cell);
    if(it==cells_.end()) throw std::runtime_error("Referenced cell "+cell+" has no value");
    if(!it->second.ast) throw std::runtime_error("Invalid formula in "+cell);
    try { it->second.value=evaluateNode(it->second.ast,cell); it->second.hasValue=true; return it->second.value; }
    catch(const std::exception& e) {
      errors_[cell]=e.what();
      throw std::runtime_error("Cell "+cell+": "+e.what());
    }
}

double SpreadsheetEvaluator::evaluateNode(const ASTPtr& n,const std::string& owner) {
    if(!n) throw std::runtime_error("Empty expression");
    switch(n->type) {
      case NodeType::Number: return n->number;
      case NodeType::CellRef: return getCellValue(n->text,owner);
      case NodeType::Range: throw std::runtime_error("A range is only valid as a function argument");
      case NodeType::BinaryOp: {
        const double a=evaluateNode(n->left,owner), b=evaluateNode(n->right,owner);
        switch(n->op) { case '+':return a+b; case '-':return a-b; case '*':return a*b;
          case '/':if(b==0.0) throw std::runtime_error("Division by zero"); return a/b;
          default:throw std::runtime_error("Unknown arithmetic operator"); }
      }
      case NodeType::FuncCall: {
        std::vector<double> vs;
        for(const auto& arg:n->args) {
          if(arg->type==NodeType::Range) {
            auto more=expandRange(arg->rangeStart,arg->rangeEnd); vs.insert(vs.end(),more.begin(),more.end());
          } else vs.push_back(evaluateNode(arg,owner));
        }
        if(n->text=="SUM") { double s=0; for(double v:vs)s+=v; return s; }
        if(n->text=="COUNT") return static_cast<double>(vs.size());
        if(vs.empty()) throw std::runtime_error(n->text+" requires at least one argument");
        if(n->text=="AVG") { double s=0;for(double v:vs)s+=v;return s/static_cast<double>(vs.size()); }
        if(n->text=="MAX") return *std::max_element(vs.begin(),vs.end());
        if(n->text=="MIN") return *std::min_element(vs.begin(),vs.end());
        throw std::runtime_error("Unsupported function "+n->text);
      }
    }
    throw std::runtime_error("Unknown AST node");
}
EvaluationResult SpreadsheetEvaluator::evaluate(const std::map<std::string,std::string>& formulas,
                                                const std::map<std::string,double>& inputs) {
    cells_.clear(); inputs_.clear(); visitState_.clear(); stack_.clear(); order_.clear(); errors_.clear();
    for(const auto& p:inputs) inputs_[normalizeCell(p.first)]=p.second;
    for(const auto& p:formulas) {
      const std::string name=normalizeCell(p.first);
      CellEntry e; e.formula=p.second;
      if(inputs_.count(name)) { errors_[name]="Cell cannot contain both a constant value and a formula"; cells_[name]=std::move(e); continue; }
      try { Lexer l(p.second); Parser parser(l.tokenize()); e.ast=parser.parseFormula(); collectDependencies(e.ast,e.dependsOn); }
      catch(const std::exception& ex) { e.error=ex.what(); errors_[name]=ex.what(); }
      cells_[name]=std::move(e);
    }
    for(const auto& p:cells_) if(p.second.ast) {
      try { visit(p.first); } catch(const std::exception& e) { errors_[p.first]=e.what(); }
    }
    EvaluationResult result; result.evaluationOrder=order_;
    for(const auto& name:order_) {
      if(errors_.count(name)) continue;
      auto it=cells_.find(name); if(it==cells_.end()||!it->second.ast) continue;
      try {
        const double v=getCellValue(name,name);
        if(!std::isfinite(v)) throw std::runtime_error("Result is not finite");
        result.values[name]=v;
      } catch(const std::exception& e) { errors_[name]=e.what(); }
    }
    result.errors=errors_; return result;
}