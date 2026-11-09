cmake_minimum_required(VERSION 3.20)
project(iqai_native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_path(
  NODE_API_INCLUDE_DIR
  node_api.h
  HINTS "$ENV{PREFIX}/include/node"
  REQUIRED
)

add_library(iqai_native SHARED src/addon.cpp)

target_include_directories(iqai_native SYSTEM PRIVATE
  "${NODE_API_INCLUDE_DIR}"
)

target_compile_definitions(iqai_native PRIVATE NAPI_VERSION=8)

target_compile_options(iqai_native PRIVATE
  -Wall
  -Wextra
  -Wpedantic
)

set_target_properties(iqai_native PROPERTIES
  PREFIX ""
  SUFFIX ".node"
  LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/Release"
)
