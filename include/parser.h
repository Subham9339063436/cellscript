#pragma once
#include "ast.h"
#include "lexer.h"

#include <vector>

class Parser {
public:
    explicit Parser(std::vector<Token> tokens);
    ASTPtr parseFormula();

private:
    std::vector<Token> tokens_;
    std::size_t position_ = 0;

    const Token& peek() const;
    const Token& advance();
    bool check(TokenType type) const;
    const Token& expect(TokenType type, const char* description);

    ASTPtr parseExpr();
    ASTPtr parseTerm();
    ASTPtr parseFactor();
    ASTPtr parseFuncCall();
    ASTPtr parseArg();
    bool looksLikeRange() const;
};
