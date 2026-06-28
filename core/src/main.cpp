#include "app/CoreApplication.hpp"

int main(int argc, char** argv) {
    lasecsimul::app::CoreConfig cfg = lasecsimul::app::parseArgs(argc, argv);
    lasecsimul::app::CoreApplication app(std::move(cfg));
    return app.run();
}
