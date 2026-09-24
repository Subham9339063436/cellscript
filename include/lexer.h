#pragma once
#include <string>
#include <vector>

// Phase 1 grammar foundation:
// formula   := "=" expr
// expr      := term (("+" | "-") term)*
// term      := factor (("*" | "/") factor)*
// factor    := NUMBER | cellRef | funcCall | "(" expr ")"
// funcCall  := FUNCNAME "(" argList ")"
// argList   := arg ("," arg)*
// arg       := range | expr
// range     := cellRef ":" cellRef
// cellRef   := LETTER+ DIGIT+

enum class TokenType {
    Equals,
    Number,
    CellRef,
    FuncName,
    Plus,
    Minus,
    Star,
    Slash,
    LParen,
    RParen,
    Colon,
    Comma,
    EndOfInput
};

struct Token {
    TokenType type;
    std::string text;
    double numberValue = 0.0;
    int column = 1;
};

class Lexer {
public:
    explicit Lexer(std::string source);

    std::vector<Token> tokenize();

private:
    std::string source_;
    std::size_t position_ = 0;

    char peek() const;
    char advance();
    bool atEnd() const;
    void skipWhitespace();
    Token lexNumber();
    Token lexIdentifier();
};

bool isKnownFunction(const std::string& name);
