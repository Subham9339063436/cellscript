#pragma once
#include "ast.h"
#include <map>
#include <set>
#include <string>
#include <vector>

struct AnalysisToken {
    std::string type;
    std::string text;
    int column = 1;
};

struct CellEntry {
    std::string formula;
    ASTPtr ast;
    std::set<std::string> dependsOn;
    double value = 0.0;
    bool hasValue = false;
    std::string error;
    std::vector<AnalysisToken> tokens;
    std::string astText;
};

struct EvaluationResult {
    std::map<std::string, double> values;
    std::map<std::string, std::string> errors;
    std::vector<std::string> evaluationOrder;
    std::map<std::string, std::vector<AnalysisToken>> tokens;
    std::map<std::string, std::string> asts;
    std::map<std::string, std::vector<std::string>> dependencies;
};

class SpreadsheetEvaluator {
public:
    EvaluationResult evaluate(const std::map<std::string, std::string>& formulas,
                              const std::map<std::string, double>& inputs = {});
private:
    std::map<std::string, CellEntry> cells_;
    std::map<std::string, double> inputs_;
    std::map<std::string, int> visitState_;
    std::vector<std::string> stack_;
    std::vector<std::string> order_;
    std::map<std::string, std::string> errors_;
    void collectDependencies(const ASTPtr& node, std::set<std::string>& deps);
    void visit(const std::string& cell);
    double evaluateNode(const ASTPtr& node, const std::string& owner);
    double getCellValue(const std::string& cell, const std::string& owner);
    std::vector<double> expandRange(const std::string& start, const std::string& end);
    static std::string normalizeCell(const std::string& cell);
};