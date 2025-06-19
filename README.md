# Aplikacja webowa umożliwiająca proste gry 1v1 za pieniądze

## Opis projektu

Oferuje graczom pojedynki 1v1 w gry typu “Battleships” przez internet. Gracze wpłacają opłatę przed każdą grą, wygrany dostaje 75% sumy wpłaconej przez obu graczy, a reszta zostaje właścicielom platformy. Aplikacja umożliwia zarządzanie kontami graczy, rejestrowanie transakcji finansowych oraz wyników pojedynków, a także generowanie rankingów i statystyk.

## Podział na role

Frontend: hniewier, ajedrych\
Backend: mzielin1, agolebie, bjusiak

## Stack technologiczny

**`apps/api/`**:

- Zawiera logikę backendową zbudowaną przy użyciu NestJS.
- Obsługuje logikę biznesową, punkty końcowe API, interakcje z bazą danych, uwierzytelnianie użytkowników, mechanikę gier oraz przetwarzanie transakcji.
- Logika aplikacji backendowej opiera się na bazie danych Oracle do przechowywania wszystkich danych i zarządzania nimi.

**`apps/web/`**:

- Zawiera interfejs użytkownika frontendowego zbudowany przy użyciu Next.js.
- Odpowiada za renderowanie interfejsu użytkownika, obsługę interakcji użytkownika oraz komunikację z backendowym API.

## Implementowane gry

Papier, kamień, nożyce\
Battleships\
Saper na czas

## Dokumentacja

Dokładny opis implementacji i technologii znajduje się w pliku `docs/dokumentacja.pdf`.
