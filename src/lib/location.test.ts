import { formatAccuracy, formatCoordinates, isGpsValue, mapsUrl } from "./location";

test("coordinates read as degrees with hemisphere letters", () => {
  expect(formatCoordinates({ latitude: 31.46458, longitude: 74.23972 })).toBe("31.4646° N, 74.2397° E");
  expect(formatCoordinates({ latitude: -33.8688, longitude: -70.1 })).toBe("33.8688° S, 70.1000° W");
});

test("accuracy is rounded, and omitted when the phone didn't report one", () => {
  expect(formatAccuracy({ latitude: 1, longitude: 1, accuracy: 99.6 })).toBe("±100 m");
  expect(formatAccuracy({ latitude: 1, longitude: 1 })).toBeNull();
  expect(formatAccuracy({ latitude: 1, longitude: 1, accuracy: null })).toBeNull();
});

test("only a real reading counts as a GPS value", () => {
  expect(isGpsValue({ latitude: 1, longitude: 2 })).toBe(true);
  expect(isGpsValue({ latitude: "1", longitude: 2 })).toBe(false);
  expect(isGpsValue(null)).toBe(false);
  expect(isGpsValue("nope")).toBe(false);
  expect(isGpsValue({ latitude: NaN, longitude: 2 })).toBe(false);
});

test("the maps link carries the coordinates", () => {
  expect(mapsUrl({ latitude: 1.5, longitude: 2.5 })).toContain("query=1.5,2.5");
});
