export class AccessPolicy {
  #allowedOpenIds;
  #allowedWorkdirs;
  #defaultWorkdir;

  constructor({ allowedOpenIds = [], allowedWorkdirs = [], defaultWorkdir = null }) {
    this.#allowedOpenIds = new Set(allowedOpenIds);
    this.#allowedWorkdirs = new Set(allowedWorkdirs);

    if (defaultWorkdir && !this.#allowedWorkdirs.has(defaultWorkdir)) {
      throw new Error("FCA_DEFAULT_WORKDIR must be included in FCA_ALLOWED_WORKDIRS");
    }

    this.#defaultWorkdir = defaultWorkdir;
  }

  canUseOpenId(openId) {
    if (!openId) {
      return false;
    }

    return this.#allowedOpenIds.has(openId);
  }

  canUseWorkdir(workdir) {
    if (!workdir) {
      return false;
    }

    return this.#allowedWorkdirs.has(workdir);
  }

  defaultWorkdir() {
    return this.#defaultWorkdir;
  }
}
