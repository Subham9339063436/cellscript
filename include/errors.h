#pragma once
#include <stdexcept>
#include <string>

class CompileError : public std::runtime_error {
public:
    std::string kind;
    int column;

    CompileError(std::string kind_, int column_, const std::string& message)
        : std::runtime_error(message), kind(std::move(kind_)), column(column_) {}
};
