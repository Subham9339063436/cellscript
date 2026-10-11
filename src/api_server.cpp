#include "evaluator.h"

#include <algorithm>
#include <cctype>
#include <cerrno>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

namespace {
const std::size_t kMaxRequestBytes = 2U * 1024U * 1024U;

class JsonReader {
public:
    explicit JsonReader(const std::string& source) : source_(source) {}

    void parseWorkbook(std::map<std::string, std::string>& formulas,
                       std::map<std::string, double>& values) {
        whitespace();
        expect('{');
        whitespace();
        while (!consume('}')) {
            const std::string key = string();
            whitespace(); expect(':'); whitespace();
            if (key == "formulas") parseStringMap(formulas);
            else if (key == "values") parseNumberMap(values);
            else skipValue();
            whitespace();
            if (consume('}')) break;
            expect(',');
            whitespace();
        }
        whitespace();
        if (position_ != source_.size()) fail("Unexpected text after JSON object");
    }

private:
    const std::string& source_;
    std::size_t position_ = 0;

    [[noreturn]] void fail(const std::string& message) const {
        throw std::runtime_error("Invalid JSON at byte " + std::to_string(position_) + ": " + message);
    }
    void whitespace() {
        while (position_ < source_.size() &&
               std::isspace(static_cast<unsigned char>(source_[position_]))) ++position_;
    }
    bool consume(char c) {
        whitespace();
        if (position_ < source_.size() && source_[position_] == c) { ++position_; return true; }
        return false;
    }
    void expect(char c) {
        whitespace();
        if (position_ >= source_.size() || source_[position_] != c)
            fail(std::string("Expected '") + c + "'");
        ++position_;
    }
    static void appendUtf8(std::string& out, unsigned int cp) {
        if (cp <= 0x7f) out.push_back(static_cast<char>(cp));
        else if (cp <= 0x7ff) {
            out.push_back(static_cast<char>(0xc0 | (cp >> 6)));
            out.push_back(static_cast<char>(0x80 | (cp & 0x3f)));
        } else {
            out.push_back(static_cast<char>(0xe0 | (cp >> 12)));
            out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3f)));
            out.push_back(static_cast<char>(0x80 | (cp & 0x3f)));
        }
    }
    std::string string() {
        whitespace(); expect('"');
        std::string out;
        while (position_ < source_.size()) {
            const unsigned char c = static_cast<unsigned char>(source_[position_++]);
            if (c == '"') return out;
            if (c < 0x20) fail("Unescaped control character in string");
            if (c != '\\') { out.push_back(static_cast<char>(c)); continue; }
            if (position_ >= source_.size()) fail("Incomplete escape sequence");
            const char escaped = source_[position_++];
            switch (escaped) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'b': out.push_back('\b'); break;
                case 'f': out.push_back('\f'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                case 'u': {
                    if (position_ + 4 > source_.size()) fail("Incomplete Unicode escape");
                    unsigned int cp = 0;
                    for (int n = 0; n < 4; ++n) {
                        const char h = source_[position_++];
                        cp <<= 4;
                        if (h >= '0' && h <= '9') cp += static_cast<unsigned int>(h - '0');
                        else if (h >= 'a' && h <= 'f') cp += static_cast<unsigned int>(h - 'a' + 10);
                        else if (h >= 'A' && h <= 'F') cp += static_cast<unsigned int>(h - 'A' + 10);
                        else fail("Invalid Unicode escape");
                    }
                    appendUtf8(out, cp);
                    break;
                }
                default: fail("Unknown string escape");
            }
        }
        fail("Unterminated string");
    }
    void parseStringMap(std::map<std::string, std::string>& out) {
        expect('{'); whitespace();
        if (consume('}')) return;
        while (true) {
            const std::string key = string(); whitespace(); expect(':'); whitespace();
            out[key] = string(); whitespace();
            if (consume('}')) return;
            expect(',');
        }
    }
    void parseNumberMap(std::map<std::string, double>& out) {
        expect('{'); whitespace();
        if (consume('}')) return;
        while (true) {
            const std::string key = string(); whitespace(); expect(':'); whitespace();
            const std::size_t start = position_;
            while (position_ < source_.size()) {
                const char c = source_[position_];
                if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' ||
                    c == 'e' || c == 'E') ++position_;
                else break;
            }
            if (start == position_) fail("Expected numeric cell value");
            try {
                const std::string number = source_.substr(start, position_ - start);
                std::size_t used = 0;
                const double value = std::stod(number, &used);
                if (used != number.size() || !std::isfinite(value)) fail("Cell values must be finite numbers");
                out[key] = value;
            } catch (const std::exception&) {
                fail("Invalid numeric cell value");
            }
            whitespace();
            if (consume('}')) return;
            expect(',');
        }
    }
    void skipValue() {
        whitespace();
        if (position_ >= source_.size()) fail("Expected a JSON value");
        if (source_[position_] == '"') { (void)string(); return; }
        if (source_[position_] == '{') {
            ++position_; whitespace();
            if (consume('}')) return;
            while (true) {
                (void)string(); whitespace(); expect(':'); skipValue(); whitespace();
                if (consume('}')) return;
                expect(',');
            }
        }
        if (source_[position_] == '[') {
            ++position_; whitespace();
            if (consume(']')) return;
            while (true) {
                skipValue(); whitespace();
                if (consume(']')) return;
                expect(',');
            }
        }
        const std::size_t start = position_;
        while (position_ < source_.size() && source_[position_] != ',' &&
               source_[position_] != '}' && source_[position_] != ']' &&
               !std::isspace(static_cast<unsigned char>(source_[position_]))) ++position_;
        if (start == position_) fail("Invalid JSON value");
    }
};

std::string jsonEscape(const std::string& value) {
    std::ostringstream out;
    for (unsigned char c : value) {
        switch (c) {
            case '"': out << "\\\""; break;
            case '\\': out << "\\\\"; break;
            case '\b': out << "\\b"; break;
            case '\f': out << "\\f"; break;
            case '\n': out << "\\n"; break;
            case '\r': out << "\\r"; break;
            case '\t': out << "\\t"; break;
            default:
                if (c < 0x20) out << "\\u" << std::hex << std::setw(4) << std::setfill('0')
                                  << static_cast<int>(c) << std::dec;
                else out << static_cast<char>(c);
        }
    }
    return out.str();
}

std::string resultJson(const EvaluationResult& result) {
    std::ostringstream out;
    out << std::setprecision(15) << "{\"values\":{";
    bool first = true;
    for (const auto& item : result.values) {
        if (!first) out << ',';
        first = false;
        out << '"' << jsonEscape(item.first) << "\":" << item.second;
    }
    out << "},\"errors\":{";
    first = true;
    for (const auto& item : result.errors) {
        if (!first) out << ',';
        first = false;
        out << '"' << jsonEscape(item.first) << "\":\"" << jsonEscape(item.second) << '"';
    }
    out << "},\"evaluationOrder\":[";
    first = true;
    for (const auto& cell : result.evaluationOrder) {
        if (!first) out << ',';
        first = false;
        out << '"' << jsonEscape(cell) << '"';
    }
    out << "]}";
    return out.str();
}

std::size_t contentLength(const std::string& headers) {
    std::istringstream lines(headers);
    std::string line;
    std::getline(lines, line);
    while (std::getline(lines, line)) {
        while (!line.empty() && (line.back() == '\r' || line.back() == ' ' || line.back() == '\t'))
            line.pop_back();
        const std::string prefix = "content-length:";
        std::string lower = line;
        for (char& c : lower) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        if (lower.compare(0, prefix.size(), prefix) == 0) {
            try { return static_cast<std::size_t>(std::stoull(line.substr(prefix.size()))); }
            catch (...) { throw std::runtime_error("Invalid Content-Length header"); }
        }
    }
    return 0;
}

std::string receiveRequest(int client) {
    std::string data;
    char buffer[4096];
    for (;;) {
        const ssize_t got = ::recv(client, buffer, sizeof(buffer), 0);
        if (got == 0) break;
        if (got < 0) {
            if (errno == EINTR) continue;
            throw std::runtime_error("Failed reading request");
        }
        data.append(buffer, static_cast<std::size_t>(got));
        if (data.size() > kMaxRequestBytes) throw std::runtime_error("Request is too large");
        const std::size_t headerEnd = data.find("\r\n\r\n");
        if (headerEnd != std::string::npos) {
            const std::size_t bodySize = contentLength(data.substr(0, headerEnd));
            if (bodySize > kMaxRequestBytes - headerEnd - 4)
                throw std::runtime_error("Request body is too large");
            if (data.size() >= headerEnd + 4 + bodySize) return data;
        }
    }
    return data;
}

void sendResponse(int client, int status, const std::string& reason, const std::string& body) {
    std::ostringstream response;
    response << "HTTP/1.1 " << status << ' ' << reason << "\r\n"
             << "Content-Type: application/json; charset=utf-8\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Content-Length: " << body.size() << "\r\n"
             << "Connection: close\r\n\r\n" << body;
    const std::string wire = response.str();
    std::size_t sent = 0;
    while (sent < wire.size()) {
        const ssize_t n = ::send(client, wire.data() + sent, wire.size() - sent, 0);
        if (n < 0) { if (errno == EINTR) continue; break; }
        if (n == 0) break;
        sent += static_cast<std::size_t>(n);
    }
}

void handleClient(int client, SpreadsheetEvaluator& evaluator) {
    try {
        const std::string request = receiveRequest(client);
        const std::size_t headerEnd = request.find("\r\n\r\n");
        if (headerEnd == std::string::npos) throw std::runtime_error("Malformed HTTP request");
        std::istringstream firstLine(request.substr(0, request.find("\r\n")));
        std::string method, path, version;
        firstLine >> method >> path >> version;
        if (method == "OPTIONS") { sendResponse(client, 204, "No Content", ""); return; }
        if (method == "GET" && path == "/health") {
            sendResponse(client, 200, "OK", "{\"status\":\"ok\",\"service\":\"CellScript API\"}");
            return;
        }
        if (method == "POST" && path == "/evaluate") {
            const std::size_t length = contentLength(request.substr(0, headerEnd));
            const std::string body = request.substr(headerEnd + 4, length);
            std::map<std::string, std::string> formulas;
            std::map<std::string, double> values;
            JsonReader(body).parseWorkbook(formulas, values);
            const EvaluationResult result = evaluator.evaluate(formulas, values);
            sendResponse(client, 200, "OK", resultJson(result));
            return;
        }
        sendResponse(client, 404, "Not Found", "{\"error\":\"Route not found. Use GET /health or POST /evaluate.\"}");
    } catch (const std::exception& e) {
        sendResponse(client, 400, "Bad Request", std::string("{\"error\":\"") + jsonEscape(e.what()) + "\"}");
    }
}
}

int main(int argc, char** argv) {
    int port = 8080;
    if (argc > 1) {
        try { port = std::stoi(argv[1]); }
        catch (...) { std::cerr << "Usage: cellscript-api [port]\n"; return 2; }
    }
    if (port < 1 || port > 65535) { std::cerr << "Port must be between 1 and 65535.\n"; return 2; }

    const int server = ::socket(AF_INET, SOCK_STREAM, 0);
    if (server < 0) { std::cerr << "Could not create server socket.\n"; return 1; }
    int reuse = 1;
    (void)::setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse));

    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = htons(static_cast<unsigned short>(port));
    if (::bind(server, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
        std::cerr << "Could not bind port " << port << ": " << std::strerror(errno) << "\n";
        ::close(server); return 1;
    }
    if (::listen(server, 16) < 0) {
        std::cerr << "Could not listen on port " << port << ".\n";
        ::close(server); return 1;
    }

    std::cout << "CellScript API listening on http://localhost:" << port << "\n"
              << "Health check: GET /health | Evaluation: POST /evaluate\n";
    SpreadsheetEvaluator evaluator;
    for (;;) {
        const int client = ::accept(server, nullptr, nullptr);
        if (client < 0) { if (errno == EINTR) continue; std::cerr << "Accept failed.\n"; continue; }
        handleClient(client, evaluator);
        ::close(client);
    }
}