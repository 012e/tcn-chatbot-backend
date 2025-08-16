export class InvalidInputFormatException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputFormatException";
  }
}
