import { expect, test } from "vitest";
import { validateForm, amountValid, type FormValues } from "./formValidation";
const fields: FormValues = {
  title: "Plan",
  amount: "10.01",
  date: "2028-02-29",
  time: "17:30",
  email: "",
};
test("validation identifies the field and disappears after correction", () => {
  expect(validateForm("expense", { ...fields, title: "" })?.field).toBe(
    "title",
  );
  expect(validateForm("expense", { ...fields, amount: "10.001" })?.field).toBe(
    "amount",
  );
  expect(validateForm("expense", fields)).toBeNull();
});
test("dates reject impossible days and time errors stay distinct", () => {
  expect(validateForm("hangout", fields)).toBeNull();
  expect(
    validateForm("hangout", { ...fields, date: "2027-02-29" })?.field,
  ).toBe("date");
  expect(
    validateForm("hangout", { ...fields, date: "2028-04-31" })?.field,
  ).toBe("date");
  expect(validateForm("hangout", { ...fields, time: "24:00" })?.field).toBe(
    "time",
  );
  expect(
    validateForm("quiet", { ...fields, date: "22:00", time: "08:00" }),
  ).toBeNull();
});
test("money boundaries and optional university email remain consistent", () => {
  expect(amountValid("0.01")).toBe(true);
  expect(amountValid("100000")).toBe(true);
  for (const value of ["0", "-1", "100000.01", "1e2", "NaN"])
    expect(amountValid(value)).toBe(false);
  expect(validateForm("profile", fields)).toBeNull();
  expect(validateForm("profile", { ...fields, email: "bad" })?.field).toBe(
    "email",
  );
});
