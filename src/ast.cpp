#include "ast.h"

#include <iomanip>
#include <sstream>

std::shared_ptr<ASTNode> ASTNode::makeNumber(double value, int column) {
    auto node = std::make_shared<ASTNode>();
    node->type = NodeType::Number;
    node->number = value;
    node->sourceColumn = column;
    return node;
}

std::shared_ptr<ASTNode> ASTNode::makeCellRef(const std::string& ref, int column) {
    auto node = std::make_shared<ASTNode>();
    node->type = NodeType::CellRef;
    node->text = ref;
    node->sourceColumn = column;
    return node;
}

std::shared_ptr<ASTNode> ASTNode::makeBinaryOp(char operatorChar,
                                                std::shared_ptr<ASTNode> lhs,
                                                std::shared_ptr<ASTNode> rhs,
                                                int column) {
    auto node = std::make_shared<ASTNode>();
    node->type = NodeType::BinaryOp;
    node->op = operatorChar;
    node->left = std::move(lhs);
    node->right = std::move(rhs);
    node->sourceColumn = column;
    return node;
}

std::shared_ptr<ASTNode> ASTNode::makeFuncCall(const std::string& name,
                                               std::vector<std::shared_ptr<ASTNode>> arguments,
                                               int column) {
    auto node = std::make_shared<ASTNode>();
    node->type = NodeType::FuncCall;
    node->text = name;
    node->args = std::move(arguments);
    node->sourceColumn = column;
    return node;
}

std::shared_ptr<ASTNode> ASTNode::makeRange(const std::string& start,
                                            const std::string& end,
                                            int column) {
    auto node = std::make_shared<ASTNode>();
    node->type = NodeType::Range;
    node->rangeStart = start;
    node->rangeEnd = end;
    node->sourceColumn = column;
    return node;
}

static std::string indent(int depth) {
    return std::string(static_cast<std::size_t>(depth) * 2U, ' ');
}

std::string astToString(const ASTPtr& node, int depth) {
    if (!node) {
        return "";
    }

    std::ostringstream out;
    const std::string pad = indent(depth);

    switch (node->type) {
        case NodeType::Number:
            out << pad << "Number(" << std::setprecision(15) << node->number << ")\n";
            break;
        case NodeType::CellRef:
            out << pad << "CellRef(" << node->text << ")\n";
            break;
        case NodeType::Range:
            out << pad << "Range(" << node->rangeStart << ":" << node->rangeEnd << ")\n";
            break;
        case NodeType::BinaryOp:
            out << pad << "BinaryOp(" << node->op << ")\n";
            out << astToString(node->left, depth + 1);
            out << astToString(node->right, depth + 1);
            break;
        case NodeType::FuncCall:
            out << pad << "FuncCall(" << node->text << ")\n";
            for (const auto& arg : node->args) {
                out << astToString(arg, depth + 1);
            }
            break;
    }

    return out.str();
}
