#include "evaluator.h"

#include <cmath>
#include <iostream>
#include <map>
#include <stdexcept>
#include <string>

static void require(bool condition, const std::string& message) {
    if (!condition) throw std::runtime_error(message);
}
static bool near(double a, double b) { return std::fabs(a-b) < 1e-9; }

int main() {
    try {
        SpreadsheetEvaluator evaluator;

        // Forward references are evaluated in dependency order, not map/entry order.
        auto forward = evaluator.evaluate({
            {"C1", "=A1+B1"}, {"B1", "=A1*2"}, {"A1", "=5"}
        });
        require(forward.errors.empty(), "forward-reference workbook should have no errors");
        require(near(forward.values.at("A1"), 5), "A1 should equal 5");
        require(near(forward.values.at("B1"), 10), "B1 should equal 10");
        require(near(forward.values.at("C1"), 15), "C1 should equal 15");

        // Aggregates tolerate empty cells inside a selected rectangular range.
        auto ranges = evaluator.evaluate({
            {"A1", "=SUM(B1:B3)"}, {"A2", "=COUNT(B1:B3)"}
        });
        require(ranges.errors.empty(), "blank range cells must not be treated as missing-reference errors");
        require(near(ranges.values.at("A1"), 0), "SUM of blank cells should be zero");
        require(near(ranges.values.at("A2"), 0), "COUNT should ignore blank cells");

        auto countValues = evaluator.evaluate({{"A1", "=10"}, {"C1", "=COUNT(A1:B1)"}});
        require(countValues.errors.empty() && near(countValues.values.at("C1"), 1),
                "COUNT should count populated numeric cells, not blanks");

        auto functions = evaluator.evaluate({
            {"A1", "=10"}, {"A2", "=20"}, {"A3", "=30"},
            {"B1", "=SUM(A1:A3)"}, {"B2", "=AVG(A1:A3)"},
            {"B3", "=MAX(A1:A3)"}, {"C1", "=MIN(A1:A3)"}
        });
        require(functions.errors.empty(), "aggregate-function workbook should have no errors");
        require(near(functions.values.at("B1"), 60), "SUM should equal 60");
        require(near(functions.values.at("B2"), 20), "AVG should equal 20");
        require(near(functions.values.at("B3"), 30), "MAX should equal 30");
        require(near(functions.values.at("C1"), 10), "MIN should equal 10");

        auto cycle = evaluator.evaluate({{"A1", "=B1+1"}, {"B1", "=A1+1"}});
        require(cycle.errors.count("A1") && cycle.errors.count("B1"),
                "both cells involved in a circular dependency must be reported");

        auto missing = evaluator.evaluate({{"A1", "=Z99+1"}});
        require(missing.errors.count("A1"), "direct reference to a missing cell must be reported");

        auto zeroDivision = evaluator.evaluate({{"A1", "=4/0"}});
        require(zeroDivision.errors.count("A1"), "division by zero must be reported");

        auto inputs = evaluator.evaluate({{"B1", "=A1*3"}}, {{"A1", 7}});
        require(inputs.errors.empty() && near(inputs.values.at("B1"), 21),
                "provided numeric inputs should resolve cell references");

        std::cout << "Phase 2 evaluator tests passed.\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Phase 2 evaluator test failed: " << e.what() << "\n";
        return 1;
    }
}