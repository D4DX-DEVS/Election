/**
 * Franchise contact fields stored in franchises.settings (jsonb).
 * Portal sends websiteUrl / contactNumber; API persists them in settings.
 */

function asTrimmedString(value) {
  if (value == null) return "";
  return String(value).trim();
}

/** Read website/contact from settings or legacy top-level API fields. */
function readFranchiseContactFields(source = {}) {
  const settings =
    source.settings && typeof source.settings === "object" ? source.settings : {};
  return {
    websiteUrl: asTrimmedString(settings.websiteUrl || source.websiteUrl),
    contactNumber: asTrimmedString(settings.contactNumber || source.contactNumber),
    contactEmail: asTrimmedString(settings.contactEmail || source.contactEmail),
  };
}

/** Merge portal payload into settings without dropping unrelated keys. */
function mergeFranchiseSettings(existing = {}, data = {}) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};

  if (data.settings && typeof data.settings === "object" && !Array.isArray(data.settings)) {
    Object.assign(base, data.settings);
  }

  if (data.websiteUrl !== undefined) {
    const websiteUrl = asTrimmedString(data.websiteUrl);
    if (websiteUrl) base.websiteUrl = websiteUrl;
    else delete base.websiteUrl;
  }

  if (data.contactNumber !== undefined) {
    const contactNumber = asTrimmedString(data.contactNumber);
    if (contactNumber) base.contactNumber = contactNumber;
    else delete base.contactNumber;
  }

  if (data.contactEmail !== undefined) {
    const contactEmail = asTrimmedString(data.contactEmail);
    if (contactEmail) base.contactEmail = contactEmail;
    else delete base.contactEmail;
  }

  return base;
}

module.exports = {
  readFranchiseContactFields,
  mergeFranchiseSettings,
};
