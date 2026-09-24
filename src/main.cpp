#include "errors.h"
#include "lexer.h"
#include "parser.h"

#include <iostream>

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
    const std::string formula = argc > 1 ? argv[1] : "=SUM(A1:B3)+C2*2";

    std::cout << "CellScript Phase 1\n";
    std::cout << "Formula: " << formula << "\n\n";

    try {
        Lexer lexer(formula);
        const auto tokens = lexer.tokenize();

        std::cout << "Tokens:\n";
        for (const auto& token : tokens) {
            std::cout << "  " << tokenTypeName(token.type)
                      << "  '" << token.text << "'"
                      << "  (col " << token.column << ")\n";
        }

        Parser parser(tokens);
        const ASTPtr ast = parser.parseFormula();

        std::cout << "\nAST:\n";
        std::cout << astToString(ast);
    } catch (const CompileError& error) {
        std::cerr << "\n[" << error.kind << " Error] column " << error.column
                  << ": " << error.what() << "\n";
        return 1;
    }

    return 0;
}
