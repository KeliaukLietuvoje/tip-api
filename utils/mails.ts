import { ServerClient } from "postmark";

let client: ServerClient;
if (process.env.POSTMARK_KEY) {
  client = new ServerClient(process.env.POSTMARK_KEY);
}

const sender = "noreply@ntis.lt";

export function emailCanBeSent() {
  if (!client) return false;

  return ["production"].includes(process.env.NODE_ENV);
}

function hostUrl(isAdmin: boolean = false) {
  return isAdmin ? process.env.ADMIN_HOST : process.env.APP_HOST;
}

export function notifyOnFormUpdate(
  email: string,
  status: string,
  formId: number | string,
  formType: string,
  objectName: string,
  objectId: string,
  isAdmin: boolean = false
) {}
