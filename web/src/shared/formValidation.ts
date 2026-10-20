export type FormValues = {
  title: string;
  amount: string;
  date: string;
  time: string;
  email: string;
};
export type FormIssue = { field: keyof FormValues; message: string };
export function amountValid(value: string) {
  return (
    /^\d+(\.\d{1,2})?$/.test(value.trim()) &&
    Number(value) > 0 &&
    Number(value) <= 100000
  );
}
export function validateForm(
  kind: string,
  values: FormValues,
): FormIssue | null {
  const names: Record<string, string> = {
    task: "task name",
    grocery: "grocery item",
    expense: "expense name",
    hangout: "plan name",
    space: "space name",
    profile: "first name",
    maintenance: "issue description",
    concern: "concern",
  };
  if (names[kind] && !values.title.trim())
    return { field: "title", message: `Enter the ${names[kind]}.` };
  if (kind === "expense" && !amountValid(values.amount))
    return {
      field: "amount",
      message: "Amount: use $0.01–$100,000 with at most two decimal places.",
    };
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (kind === "hangout") {
    const date = new Date(values.date + "T12:00:00");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(values.date) ||
      !Number.isFinite(date.getTime()) ||
      date.getFullYear() !== Number(values.date.slice(0, 4)) ||
      date.getMonth() + 1 !== Number(values.date.slice(5, 7)) ||
      date.getDate() !== Number(values.date.slice(8, 10))
    )
      return {
        field: "date",
        message: "Date: enter a real calendar date in YYYY-MM-DD format.",
      };
    if (!validTime(values.time))
      return {
        field: "time",
        message: "Time: use 24-hour HH:MM, such as 17:30.",
      };
  }
  if (kind === "quiet") {
    if (!validTime(values.date))
      return {
        field: "date",
        message: "Start time: use 24-hour HH:MM, such as 22:00.",
      };
    if (!validTime(values.time))
      return {
        field: "time",
        message: "End time: use 24-hour HH:MM, such as 08:00.",
      };
  }
  if (
    kind === "profile" &&
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.edu$/i.test(values.email.trim())
  )
    return {
      field: "email",
      message: "Email: use your university .edu address, or leave it empty.",
    };
  return null;
}
