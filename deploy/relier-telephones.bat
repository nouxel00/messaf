@echo off
rem Relie chaque telephone branche en USB aux services MESSAF de cet ordinateur :
rem Synapse (8008), MAS (8280) et Keycloak (8180). A relancer apres chaque debranchement.
for /f "skip=1 tokens=1" %%d in ('adb devices') do (
  adb -s %%d reverse tcp:8008 tcp:8008 >nul
  adb -s %%d reverse tcp:8280 tcp:8280 >nul
  adb -s %%d reverse tcp:8180 tcp:8180 >nul
  echo Telephone %%d relie : ports 8008, 8280 et 8180
)
