// File: src/types/ai/tools.js
// Types untuk AI tools

// GetPriceResult type
const GetPriceResult = {
  // Success with single result
  success: true,
  service_name: "string",
  motor_size: "S" | "M" | "L" | "XL",
  price: "number",
  estimated_duration: "string",
  summary: "string"
} | {
  // Success with multiple candidates
  success: true,
  multiple_candidates: true,
  candidates: Array<{
    service_name: "string",
    motor_size: "S" | "M" | "L" | "XL",
    price: "number",
    estimated_duration: "string",
    similarity: "number"
  }>,
  message: "string"
} | {
  // Error
  success: false,
  error: "generic_error" | "price_not_available_for_size",
  message: "string",
  service_name?: "string",
  motor_size?: "S" | "M" | "L" | "XL"
};

// Session type
const Session = {
  inquiry: {
    serviceSize: "S" | "M" | "L" | "XL",
    repaintSize: "S" | "M" | "L" | "XL"
  }
};

module.exports = {
  GetPriceResult,
  Session
};
