// MVP, delete with PM-41067
export const AUTOTYPE_MVP_IPC_CHANNELS = {
  TOGGLE: "autofill.toggleAutotypeMvp",
  CONFIGURE: "autofill.configureAutotypeMvp",
  LISTEN: "autofill.listenAutotypeRequestMvp",
  EXECUTION_ERROR: "autofill.autotypeExecutionErrorMvp",
  EXECUTE: "autofill.executeAutotypeMvp",

  // Qualitative enhancements
  GET_RUNNING_WINDOWS: "autofill.getRunningWindows",
  CAPTURE_WINDOW: "autofill.captureWindow",
  OPEN_PICKER: "autofill.openPicker",
  CLOSE_PICKER: "autofill.closePicker",
  EXECUTE_SEQUENCE: "autofill.executeSequence",
  CONFIGURE_GLOBAL_SEARCH: "autofill.configureGlobalSearch",
  PICKER_INIT_DATA: "autofill.pickerInitData",
  PICKER_SELECT: "autofill.pickerSelect",
  PICKER_ITEM_CHOSEN: "autofill.pickerItemChosen",
  PICKER_COPY_FIELD: "autofill.pickerCopyField",
  PICKER_EDIT_CIPHER: "autofill.pickerEditCipher",
  PICKER_CLEAR_CLIPBOARD: "autofill.pickerClearClipboard",
  PICKER_THEME_CHANGED: "autofill.pickerThemeChanged",
} as const;

export const SSH_AGENT_IPC_CHANNELS = {
  INIT: "sshagent.init",
  IS_LOADED: "sshagent.isloaded",
  STOP: "sshagent.stop",
  REPLACE: "sshagent.replace",
  SIGN_REQUEST: "sshagent.signrequest",
  SIGN_REQUEST_RESPONSE: "sshagent.signrequestresponse",
  LIST_KEYS_REQUEST: "sshagent.listkeysrequest",
  LIST_KEYS_RESPONSE: "sshagent.listkeysresponse",
} as const;
