#include <node_api.h>

#include <cmath>
#include <cstdint>
#include <cstring>
#include <cstddef>

namespace {

napi_value throw_type_error(napi_env env, const char* message) {
  napi_throw_type_error(env, nullptr, message);
  return nullptr;
}

napi_value analyze_pcm16(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];

  napi_status status =
      napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read arguments");
    return nullptr;
  }

  if (argc != 1) {
    return throw_type_error(env, "Expected one PCM16 Buffer");
  }

  bool is_buffer = false;
  status = napi_is_buffer(env, argv[0], &is_buffer);

  if (status != napi_ok || !is_buffer) {
    return throw_type_error(env, "Input must be a Node.js Buffer");
  }

  void* raw_data = nullptr;
  size_t length = 0;

  status = napi_get_buffer_info(env, argv[0], &raw_data, &length);

  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read PCM16 Buffer");
    return nullptr;
  }

  if (length == 0 || length % sizeof(int16_t) != 0) {
    return throw_type_error(
        env, "PCM16 Buffer must contain complete 16-bit samples");
  }

  const auto* bytes = static_cast<const uint8_t*>(raw_data);
  const size_t sample_count = length / sizeof(int16_t);

  double sum_squares = 0.0;
  double peak = 0.0;

  for (size_t i = 0; i < sample_count; ++i) {
    const size_t offset = i * sizeof(int16_t);

    const uint16_t raw =
        static_cast<uint16_t>(bytes[offset]) |
        (static_cast<uint16_t>(bytes[offset + 1]) << 8);

    const int32_t signed_sample =
        (raw >= 0x8000u)
            ? static_cast<int32_t>(raw) - 65536
            : static_cast<int32_t>(raw);

    const double normalized =
        static_cast<double>(signed_sample) / 32768.0;

    const double magnitude = std::fabs(normalized);

    if (magnitude > peak) {
      peak = magnitude;
    }

    sum_squares += normalized * normalized;
  }

  const double rms =
      std::sqrt(sum_squares / static_cast<double>(sample_count));

  const double peak_dbfs =
      peak > 0.0 ? 20.0 * std::log10(peak) : -160.0;

  const double rms_dbfs =
      rms > 0.0 ? 20.0 * std::log10(rms) : -160.0;

  napi_value result;
  napi_value value;

  if (napi_create_object(env, &result) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to create result");
    return nullptr;
  }

#define SET_NUMBER(name, number)                                      \
  do {                                                                \
    if (napi_create_double(env, (number), &value) != napi_ok ||       \
        napi_set_named_property(env, result, (name), value) !=        \
            napi_ok) {                                                \
      napi_throw_error(env, nullptr, "Unable to create result field");\
      return nullptr;                                                 \
    }                                                                 \
  } while (0)

  SET_NUMBER("sampleCount", static_cast<double>(sample_count));
  SET_NUMBER("peak", peak);
  SET_NUMBER("rms", rms);
  SET_NUMBER("peakDbfs", peak_dbfs);
  SET_NUMBER("rmsDbfs", rms_dbfs);

#undef SET_NUMBER

  return result;
}


napi_value analyze_pcm24(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_status status =
      napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read arguments");
    return nullptr;
  }
  if (argc != 1) {
    return throw_type_error(env, "Expected one PCM24 Buffer");
  }
  bool is_buffer = false;
  status = napi_is_buffer(env, argv[0], &is_buffer);
  if (status != napi_ok || !is_buffer) {
    return throw_type_error(env, "Input must be a Node.js Buffer");
  }
  void* raw_data = nullptr;
  size_t length = 0;
  status = napi_get_buffer_info(env, argv[0], &raw_data, &length);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read PCM24 Buffer");
    return nullptr;
  }
  if (length == 0 || length % 3 != 0) {
    return throw_type_error(env,
        "PCM24 Buffer must contain complete 24-bit samples");
  }
  const auto* bytes = static_cast<const uint8_t*>(raw_data);
  const size_t sample_count = length / 3;
  double sum_squares = 0.0;
  double peak = 0.0;
  for (size_t i = 0; i < sample_count; ++i) {
    const size_t offset = i * 3;
    const uint32_t raw =
        static_cast<uint32_t>(bytes[offset]) |
        (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
        (static_cast<uint32_t>(bytes[offset + 2]) << 16);
    const int32_t signed_sample =
        raw >= 0x800000u
            ? static_cast<int32_t>(raw) - 16777216
            : static_cast<int32_t>(raw);
    const double normalized =
        static_cast<double>(signed_sample) / 8388608.0;
    const double magnitude = std::fabs(normalized);
    if (magnitude > peak) peak = magnitude;
    sum_squares += normalized * normalized;
  }
  const double rms =
      std::sqrt(sum_squares / static_cast<double>(sample_count));
  const double peak_dbfs =
      peak > 0.0 ? 20.0 * std::log10(peak) : -160.0;
  const double rms_dbfs =
      rms > 0.0 ? 20.0 * std::log10(rms) : -160.0;
  napi_value result;
  napi_value value;
  if (napi_create_object(env, &result) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to create result");
    return nullptr;
  }
#define SET_PCM24_NUMBER(name, number) \
  do { \
    if (napi_create_double(env, (number), &value) != napi_ok || \
        napi_set_named_property(env, result, (name), value) != napi_ok) { \
      napi_throw_error(env, nullptr, "Unable to create result field"); \
      return nullptr; \
    } \
  } while (0)
  SET_PCM24_NUMBER("sampleCount", static_cast<double>(sample_count));
  SET_PCM24_NUMBER("peak", peak);
  SET_PCM24_NUMBER("rms", rms);
  SET_PCM24_NUMBER("peakDbfs", peak_dbfs);
  SET_PCM24_NUMBER("rmsDbfs", rms_dbfs);
#undef SET_PCM24_NUMBER
  return result;
}


napi_value analyze_float32(napi_env env, napi_callback_info info) {
  static_assert(sizeof(float) == 4, "Float32 requires 4-byte float");

  size_t argc = 2;
  napi_value argv[2];
  napi_status status =
      napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read arguments");
    return nullptr;
  }
  if (argc != 1) {
    return throw_type_error(env, "Expected one Float32 Buffer");
  }

  bool is_buffer = false;
  status = napi_is_buffer(env, argv[0], &is_buffer);
  if (status != napi_ok || !is_buffer) {
    return throw_type_error(env, "Input must be a Node.js Buffer");
  }

  void* raw_data = nullptr;
  size_t length = 0;
  status = napi_get_buffer_info(env, argv[0], &raw_data, &length);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to read Float32 Buffer");
    return nullptr;
  }

  if (length == 0 || length % 4 != 0) {
    return throw_type_error(
        env, "Float32 Buffer must contain complete 32-bit samples");
  }

  const auto* bytes = static_cast<const uint8_t*>(raw_data);
  const size_t sample_count = length / 4;
  double sum_squares = 0.0;
  double peak = 0.0;

  for (size_t i = 0; i < sample_count; ++i) {
    const size_t offset = i * 4;
    const uint32_t bits =
        static_cast<uint32_t>(bytes[offset]) |
        (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
        (static_cast<uint32_t>(bytes[offset + 2]) << 16) |
        (static_cast<uint32_t>(bytes[offset + 3]) << 24);

    float sample = 0.0f;
    std::memcpy(&sample, &bits, sizeof(sample));

    if (!std::isfinite(sample)) {
      napi_throw_range_error(
          env, nullptr, "Float32 samples must be finite");
      return nullptr;
    }

    const double normalized = static_cast<double>(sample);
    const double magnitude = std::fabs(normalized);
    if (magnitude > peak) peak = magnitude;
    sum_squares += normalized * normalized;
  }

  const double rms =
      std::sqrt(sum_squares / static_cast<double>(sample_count));
  const double peak_dbfs =
      peak > 0.0 ? 20.0 * std::log10(peak) : -160.0;
  const double rms_dbfs =
      rms > 0.0 ? 20.0 * std::log10(rms) : -160.0;

  napi_value result;
  if (napi_create_object(env, &result) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to create result");
    return nullptr;
  }

  auto set_number = [&](const char* name, double number) -> bool {
    napi_value field;
    if (napi_create_double(env, number, &field) != napi_ok) {
      return false;
    }
    return napi_set_named_property(env, result, name, field) == napi_ok;
  };

  if (!set_number("sampleCount", static_cast<double>(sample_count)) ||
      !set_number("peak", peak) ||
      !set_number("rms", rms) ||
      !set_number("peakDbfs", peak_dbfs) ||
      !set_number("rmsDbfs", rms_dbfs)) {
    napi_throw_error(env, nullptr, "Unable to create result field");
    return nullptr;
  }

  return result;
}

napi_value initialize(napi_env env, napi_value exports) {
  napi_value function;

  if (napi_create_function(
          env,
          "analyzePcm16",
          NAPI_AUTO_LENGTH,
          analyze_pcm16,
          nullptr,
          &function) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to register analyzePcm16");
    return nullptr;
  }

  if (napi_set_named_property(env, exports, "analyzePcm16", function) !=
      napi_ok) {
    napi_throw_error(env, nullptr, "Unable to export analyzePcm16");
    return nullptr;
  }


  if (napi_create_function(env, "analyzePcm24", NAPI_AUTO_LENGTH,
          analyze_pcm24, nullptr, &function) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to register analyzePcm24");
    return nullptr;
  }
  if (napi_set_named_property(env, exports, "analyzePcm24", function) !=
      napi_ok) {
    napi_throw_error(env, nullptr, "Unable to export analyzePcm24");
    return nullptr;
  }


  if (napi_create_function(env, "analyzeFloat32", NAPI_AUTO_LENGTH,
          analyze_float32, nullptr, &function) != napi_ok) {
    napi_throw_error(env, nullptr, "Unable to register analyzeFloat32");
    return nullptr;
  }
  if (napi_set_named_property(env, exports, "analyzeFloat32", function) !=
      napi_ok) {
    napi_throw_error(env, nullptr, "Unable to export analyzeFloat32");
    return nullptr;
  }

  return exports;
}

}  // namespace

NAPI_MODULE(iqai_native, initialize)
