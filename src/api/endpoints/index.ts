export class AppUrl {
  admin: string;
  auth: string;
  user: string;
  common: string;
  client: string;
  product: string;
  business: string;
  merchant: string;
  employee: string;
  leadNurture: string;
  notification: string;
  stock: string;
  form: string;
  query: string;
  blog: string;
  plan: string;
  page: string;
  contact: string;
  qna: string;
  rbac: string;
  lead: string;
  quote: string;
  feedback: string;
  constructor() {
    this.admin = `v1/admin`;
    this.rbac = `v1/rbac`;
    this.auth = `v1/auth`;
    this.user = `v1/user`;
    this.common = `v1/common`;
    this.client = `v1/client`;
    this.product = `v1/product`;
    this.business = `v1/business`;
    this.query = `v1/query`;
    this.merchant = `v1/merchant`;
    this.employee = `v1/employee`;
    this.leadNurture = `v1/lead-nurture`;
    this.notification = `v1/notification`;
    this.stock = `v1/stock-media`;
    this.form = `v1/form`;
    this.blog = `v1/blog`;
    this.plan = "v1/plan";
    this.page = "v1/page";
    this.contact = "v1/contact";
    this.qna = `v1/qna`;
    this.lead = `v1/lead`;
    this.quote = `v1/quote`;
    this.feedback = `v1/feedback`;
  }
}

const appUrl = new AppUrl();

export default appUrl;
