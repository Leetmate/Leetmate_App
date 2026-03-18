function getTodayString() {
  // For demo/testing
  if (typeof window !== "undefined" && window.__leetmateFakeToday) {
    return window.__leetmateFakeToday;
  }

  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });
}