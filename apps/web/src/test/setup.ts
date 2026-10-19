import '@testing-library/jest-dom/vitest'
// jsdom does not implement the native dialog API.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
}
