#pragma once
#include <memory>
#include <string>
#include <utility>
#include <vector>

enum class NodeType {
    Number,
    CellRef,
    BinaryOp,
    FuncCall,
    Range
};

struct ASTNode {
    NodeType type;
    double number = 0.0;
    std::string text;
    char op = '\0';
    std::string rangeStart;
    std::string rangeEnd;
    std::vector<std::shared_ptr<ASTNode>> args;
    std::shared_ptr<ASTNode> left;
    std::shared_ptr<ASTNode> right;
    int sourceColumn = 0;

    static std::shared_ptr<ASTNode> makeNumber(double value, int column);
    static std::shared_ptr<ASTNode> makeCellRef(const std::string& ref, int column);
    static std::shared_ptr<ASTNode> makeBinaryOp(char operatorChar,
                                                  std::shared_ptr<ASTNode> lhs,
                                                  std::shared_ptr<ASTNode> rhs,
                                                  int column);
    static std::shared_ptr<ASTNode> makeFuncCall(const std::string& name,
                                                 std::vector<std::shared_ptr<ASTNode>> arguments,
                                                 int column);
    static std::shared_ptr<ASTNode> makeRange(const std::string& start,
                                               const std::string& end,
                                               int column);
};

using ASTPtr = std::shared_ptr<ASTNode>;

std::string astToString(const ASTPtr& node, int indent = 0);
