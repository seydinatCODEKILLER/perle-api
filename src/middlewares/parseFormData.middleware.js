/**
 * Middleware pour parser les données imbriquées du FormData
 * Convertit "settings.autoReminders" → { settings: { autoReminders: true } }
 */
export const parseNestedFormData = (req, res, next) => {
  const parsed = {
    settings: {},
    wallet: {},
  };

  Object.keys(req.body).forEach((key) => {
    const value = req.body[key];

    if (key.startsWith("settings.")) {
      const settingKey = key.replace("settings.", "");
      
      // Booleans
      if (["allowPartialPayments", "autoReminders", "emailNotifications", 
           "smsNotifications", "whatsappNotifications"].includes(settingKey)) {
        parsed.settings[settingKey] = value === "true" || value === true;
      }
      // Number
      else if (settingKey === "sessionTimeout") {
        parsed.settings[settingKey] = parseInt(value, 10);
      }
      // Array
      else if (settingKey === "reminderDays") {
        parsed.settings[settingKey] = typeof value === "string" 
          ? value.split(",").map(v => parseInt(v.trim(), 10))
          : value;
      }
    }
    else if (key.startsWith("wallet.")) {
      const walletKey = key.replace("wallet.", "");
      if (walletKey === "initialBalance") {
        parsed.wallet[walletKey] = parseFloat(value) || 0;
      }
    }
    else {
      parsed[key] = value;
    }
  });

  req.body = parsed;
  next();
};