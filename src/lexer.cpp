#include "lexer.h"
#include "errors.h"

#include <cctype>
#include <unordered_set>
#include <utility>

namespace {
const std::unordered_set<std::string> kFunctions = {
    "SUM", "AVG", "AVERAGE", "MAX", "MIN", "COUNT"
};

std::string toUpper(std::string value) {
    for (char& ch : value) {
        ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
    }
    return value;
}
}

bool isKnownFunction(const std::string& name) {
    return kFunctions.count(name) > 0;
}

Lexer::Lexer(std::string source) : source_(std::move(source)) {}

char Lexer::peek() const {
    return atEnd() ? '\0' : source_[position_];
}

char Lexer::advance() {
    return source_[position_++];
}

bool Lexer::atEnd() const {
    return position_ >= source_.size();
}

void Lexer::skipWhitespace() {
    while (!atEnd() && std::isspace(static_cast<unsigned char>(peek()))) {
        advance();
    }
}

Token Lexer::lexNumber() {
    const int startColumn = static_cast<int>(position_) + 1;
    const std::size_t start = position_;

    while (!atEnd() && std::isdigit(static_cast<unsigned char>(peek()))) {
        advance();
    }

    if (!atEnd() && peek() == '.') {
        advance();
        while (!atEnd() && std::isdigit(static_cast<unsigned char>(peek()))) {
            advance();
        }
    }

    const std::string text = source_.substr(start, position_ - start);
    return Token{TokenType::Number, text, std::stod(text), startColumn};
}

Token Lexer::lexIdentifier() {
    const int startColumn = static_cast<int>(position_) + 1;
    const std::size_t start = position_;

    while (!atEnd() && std::isalpha(static_cast<unsigned char>(peek()))) {
        advance();
    }
    const std::size_t lettersEnd = position_;

    while (!atEnd() && std::isdigit(static_cast<unsigned char>(peek()))) {
        advance();
    }

    const std::string raw = source_.substr(start, position_ - start);

    if (position_ > lettersEnd) {
        return Token{TokenType::CellRef, toUpper(raw), 0.0, startColumn};
    }

    const std::string function = toUpper(raw);
    if (!isKnownFunction(function)) {
        throw CompileError("Lexical", startColumn,
                          "Unknown function name '" + raw + "'");
    }
    return Token{TokenType::FuncName, function, 0.0, startColumn};
}

std::vector<Token> Lexer::tokenize() {
    std::vector<Token> tokens;

    skipWhitespace();
    if (atEnd() || peek() != '=') {
        throw CompileError("Lexical", 1, "Formula must start with '='");
    }
    tokens.push_back(Token{TokenType::Equals, "=", 0.0, static_cast<int>(position_) + 1});
    advance();

    while (true) {
        skipWhitespace();
        if (atEnd()) {
            break;
        }

        const char ch = peek();
        const int column = static_cast<int>(position_) + 1;

        if (std::isdigit(static_cast<unsigned char>(ch))) {
            tokens.push_back(lexNumber());
            continue;
        }
        if (std::isalpha(static_cast<unsigned char>(ch))) {
            tokens.push_back(lexIdentifier());
            continue;
        }

        Token token{};
        token.column = column;

        switch (ch) {
            case '+': token.type = TokenType::Plus; token.text = "+"; break;
            case '-': token.type = TokenType::Minus; token.text = "-"; break;
            case '*': token.type = TokenType::Star; token.text = "*"; break;
            case '/': token.type = TokenType::Slash; token.text = "/"; break;
            case '(': token.type = TokenType::LParen; token.text = "("; break;
            case ')': token.type = TokenType::RParen; token.text = ")"; break;
            case ':': token.type = TokenType::Colon; token.text = ":"; break;
            case ',': token.type = TokenType::Comma; token.text = ","; break;
            default:
                throw CompileError("Lexical", column,
                                   std::string("Unexpected character '") + ch + "'");
        }

        advance();
        tokens.push_back(std::move(token));
    }

    tokens.push_back(Token{TokenType::EndOfInput, "", 0.0, static_cast<int>(position_) + 1});
    return tokens;
}
