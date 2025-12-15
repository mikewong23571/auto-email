import { emailHandler } from "./handlers/email";
import { httpHandler } from "./handlers/http";

export default {
  fetch: httpHandler.fetch,
  email: emailHandler,
};
