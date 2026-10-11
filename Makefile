CXX := g++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -pedantic -Iinclude

BUILD_DIR := build
TARGET := $(BUILD_DIR)/cellscript
TEST_TARGET := $(BUILD_DIR)/test_evaluator
SRCS := src/ast.cpp src/lexer.cpp src/parser.cpp src/evaluator.cpp src/main.cpp
CORE_SRCS := src/ast.cpp src/lexer.cpp src/parser.cpp src/evaluator.cpp
OBJS := $(SRCS:src/%.cpp=$(BUILD_DIR)/%.o)

.PHONY: all run eval test clean

all: $(TARGET)

$(TARGET): $(OBJS) | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@

$(BUILD_DIR)/%.o: src/%.cpp | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(TEST_TARGET): $(CORE_SRCS) tests/test_evaluator.cpp | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $(CORE_SRCS) tests/test_evaluator.cpp -o $@

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

run: all
	./$(TARGET) "=SUM(A1:B3)+C2*2"

eval: all
	./$(TARGET) --eval

test: all $(TEST_TARGET)
	python3 -m pytest -q tests
	./$(TEST_TARGET)

clean:
	rm -rf $(BUILD_DIR)
