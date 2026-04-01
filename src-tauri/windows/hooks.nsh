; CrowForge NSIS Installer Hooks
; Makes the main installer fully silent when called with /S flag

!macro NSIS_HOOK_PREINSTALL
  ; Silent mode is handled by /S flag from the splash wrapper
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Write a completion marker file so splash screen knows install is done
  FileOpen $0 "$INSTDIR\.install_complete" w
  FileWrite $0 "done"
  FileClose $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Nothing needed
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up completion marker
  Delete "$INSTDIR\.install_complete"
!macroend
