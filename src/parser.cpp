#include "parser.h"
#include "errors.h"

#include <utility>

Parser::Parser(std::vector<Token> tokens) : tokens_(std::move(tokens)) {}

const Token& Parser::peek() const {
    return tokens_[position_];
}

const Token& Parser::advance() {
    const Token& token = tokens_[position_];
    if (position_ < tokens_.size() - 1U) {
        ++position_;
    }
    return token;
}

bool Parser::check(TokenType type) const {
    return peek().type == type;
}

const Token& Parser::expect(TokenType type, const char* description) {
    if (!check(type)) {
        throw CompileError("Syntax", peek().column,
                          std::string("Expected ") + description +
                          " but found '" + peek().text + "'");
    }
    return advance();
}

ASTPtr Parser::parseFormula() {
    expect(TokenType::Equals, "'='");
    ASTPtr result = parseExpr();

    if (!check(TokenType::EndOfInput)) {
        throw CompileError("Syntax", peek().column,
                          "Unexpected trailing input near '" + peek().text + "'");
    }
    return result;
}

ASTPtr Parser::parseExpr() {
    ASTPtr left = parseTerm();
    while (check(TokenType::Plus) || check(TokenType::Minus)) {
        const Token op = advance();
        ASTPtr right = parseTerm();
        left = ASTNode::makeBinaryOp(op.text[0], std::move(left), std::move(right), op.column);
    }
    return left;
}

ASTPtr Parser::parseTerm() {
    ASTPtr left = parseFactor();
    while (check(TokenType::Star) || check(TokenType::Slash)) {
        const Token op = advance();
        ASTPtr right = parseFactor();
        left = ASTNode::makeBinaryOp(op.text[0], std::move(left), std::move(right), op.column);
    }
    return left;
}

ASTPtr Parser::parseFactor() {
    if (check(TokenType::Number)) {
        const Token token = advance();
        return ASTNode::makeNumber(token.numberValue, token.column);
    }

    if (check(TokenType::CellRef)) {
        const Token token = advance();
        return ASTNode::makeCellRef(token.text, token.column);
    }

    if (check(TokenType::FuncName)) {
        return parseFuncCall();
    }

    if (check(TokenType::Minus)) {
        const Token minus = advance();
        ASTPtr operand = parseFactor();
        return ASTNode::makeBinaryOp('-', ASTNode::makeNumber(0.0, minus.column),
                                     std::move(operand), minus.column);
    }

    if (check(TokenType::LParen)) {
        advance();
        ASTPtr inner = parseExpr();
        expect(TokenType::RParen, "')'");
        return inner;
    }

    throw CompileError("Syntax", peek().column,
                      "Unexpected token '" + peek().text + "' in expression");
}

ASTPtr Parser::parseFuncCall() {
    const Token name = advance();
    expect(TokenType::LParen, "'('");

    std::vector<ASTPtr> args;
    if (!check(TokenType::RParen)) {
        args.push_back(parseArg());
        while (check(TokenType::Comma)) {
            advance();
            args.push_back(parseArg());
        }
    }

    expect(TokenType::RParen, "')'");
    return ASTNode::makeFuncCall(name.text, std::move(args), name.column);
}

bool Parser::looksLikeRange() const {
    return check(TokenType::CellRef) &&
           position_ + 1U < tokens_.size() &&
           tokens_[position_ + 1U].type == TokenType::Colon;
}

ASTPtr Parser::parseArg() {
    if (looksLikeRange()) {
        const Token start = advance();
        advance();
        const Token end = expect(TokenType::CellRef, "cell reference after ':'");
        return ASTNode::makeRange(start.text, end.text, start.column);
    }
    return parseExpr();
}
