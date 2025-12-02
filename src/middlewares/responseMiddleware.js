export class ResponseHandler {
  constructor(config = {}) {
    this.config = {
      defaultSuccessMessage:
        config.defaultSuccessMessage || "Opération réussie",
      defaultErrorMessage:
        config.defaultErrorMessage || "Une erreur est survenue",
      defaultSuccessStatus: config.defaultSuccessStatus || 200,
      defaultErrorStatus: config.defaultErrorStatus || 400,
    };
  }

  handle(req, res, next) {
    res.success = (
      data,
      message = this.config.defaultSuccessMessage,
      status = this.config.defaultSuccessStatus
    ) => {
      return res.status(status).json({ success: true, message, data });
    };

    res.error = (
      message = this.config.defaultErrorMessage,
      status = this.config.defaultErrorStatus,
      data = null
    ) => {
      return res.status(status).json({ success: false, message, data });
    };

    next();
  }
}

const responseHandlerInstance = new ResponseHandler();
export default responseHandlerInstance.handle.bind(responseHandlerInstance);
