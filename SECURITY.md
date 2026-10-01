# Security and Data Statement

## Runtime Boundary

Visual Robustness is a client-only static site. The deployed app has no
application server, database, login, analytics, or identity layer. It does not
send module responses to the project maintainers or to a third-party service.

Current progress, design choices, and transfer answers exist only in application
memory and the page URL for the active session. The app does not use browser local
storage or session storage. The development-only R asset generator can retrieve
public data from documented government APIs; those requests are not made by the
learner-facing runtime.

## Reporting Security Issues

Please do not open public issues for suspected security vulnerabilities. Contact
the repository maintainer directly, or use GitHub private vulnerability reporting
if it is enabled for this repository.

## Student Data

This prototype does not collect, transmit, store, or process student-identifiable
data. It is intended to be embedded or linked from course environments as
instructional content.

The app does not collect written reflection or provide response export. Course
assessment, written reflection, analytics, and identity-linked activity should
remain outside the app in approved systems such as the institution LMS,
Qualtrics, or approved forms.

## Hosting And Embedding

WebXR requires a secure context. The GitHub Pages deployment uses HTTPS and is the
primary headset test target. Any institution that embeds the app is responsible
for its own platform permissions, privacy notice, iframe policy, analytics, and
learning-record handling. If embedded in an iframe, the container must explicitly
permit `xr-spatial-tracking` and should be tested on the target Meta Quest browser.
