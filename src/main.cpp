#include "errors.h"
#include "evaluator.h"
#include "lexer.h"
#include "parser.h"

#include <iomanip>
#include <iostream>
#include <map>
#include <string>

const char* tokenTypeName(TokenType type) {
    switch (type) {
        case TokenType::Equals: return "Equals";
        case TokenType::Number: return "Number";
        case TokenType::CellRef: return "CellRef";
        case TokenType::FuncName: return "FuncName";
        case TokenType::Plus: return "Plus";
        case TokenType::Minus: return "Minus";
        case TokenType::Star: return "Star";
        case TokenType::Slash: return "Slash";
        case TokenType::LParen: return "LParen";
        case TokenType::RParen: return "RParen";
        case TokenType::Colon: return "Colon";
        case TokenType::Comma: return "Comma";
        case TokenType::EndOfInput: return "EndOfInput";
    }
    return "Unknown";
}

int main(int argc, char** argv) {
    if (argc > 1 && std::string(argv[1]) == "--eval") {
        const std::map<std::string, std::string> formulas = {
            {"A1", "=10"}, {"A2", "=20"}, {"A3", "=A1+A2"},
            {"B1", "=SUM(A1:A3)"}, {"B2", "=AVG(A1:A3)"},
            {"B3", "=MAX(A1:A3)"}, {"C1", "=MIN(A1:A3)"},
            {"C2", "=COUNT(A1:A3)"}, {"C3", "=B1*2"}
        };
        SpreadsheetEvaluator evaluator;
        const EvaluationResult result = evaluator.evaluate(formulas);
        std::cout << "CellScript Phase 2 evaluation demo\n" << std::fixed << std::setprecision(2);
        for (const auto& item : result.values)
            std::cout << item.first << " = " << item.second << "\n";
        for (const auto& item : result.errors)
            std::cout << item.first << " ERROR: " << item.second << "\n";
        return result.errors.empty() ? 0 : 1;
    }

    const std::string formula = argc > 1 ? argv[1] : "=SUM(A1:B3)+C2*2";
    std::cout << "CellScript Phase 1/2\nFormula: " << formula << "\n\n";
    try {
        Lexer lexer(formula);
        const auto tokens = lexer.tokenize();
        std::cout << "Tokens:\n";
        for (const auto& token : tokens)
            std::cout << "  " << tokenTypeName(token.type) << "  '" << token.text
                      << "'  (col " << token.column << ")\n";
        Parser parser(tokens);
        const ASTPtr ast = parser.parseFormula();
        std::cout << "\nAST:\n" << astToString(ast);
        std::cout << "\nRun `make eval` to see the Phase 2 spreadsheet evaluator.\n";
    } catch (const CompileError& error) {
        std::cerr << "\n[" << error.kind << " Error] column " << error.column
                  << ": " << error.what() << "\n";
        return 1;
    }
    return 0;
}