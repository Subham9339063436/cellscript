CXX := g++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -pedantic -Iinclude

BUILD_DIR := build
TARGET := $(BUILD_DIR)/cellscript
SRCS := src/ast.cpp src/lexer.cpp src/parser.cpp src/main.cpp
OBJS := $(SRCS:src/%.cpp=$(BUILD_DIR)/%.o)

.PHONY: all run test clean

all: $(TARGET)

$(TARGET): $(OBJS) | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@

$(BUILD_DIR)/%.o: src/%.cpp | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

run: all
	./$(TARGET) "=SUM(A1:B3)+C2*2"

test: all
	python3 -m pytest -q tests/test_phase1.py

clean:
	rm -rf $(BUILD_DIR)
