# MiniGames

- Sudoku: https://hs-kang-developer.github.io/MiniGames/sudoku-game/
- Puzzle Arena / 악마의 게임: https://hs-kang-developer.github.io/MiniGames/puzzle-arena/

Sudoku의 React/Vite 소스와 기존 URL은 유지합니다. Puzzle Arena는 독립 HTML/CSS/JavaScript 게임이며 한국어·일본어, 네모 세기·큐브 세기, 힌트와 기록 저장을 지원합니다.

## 설치와 검증

~~~sh
npm --prefix sudoku-game ci
npm run build
npm test
npm run preview
~~~

미리보기:
- http://127.0.0.1:4173/MiniGames/sudoku-game/
- http://127.0.0.1:4173/MiniGames/puzzle-arena/
- 브라우저 회귀 검사: http://127.0.0.1:4173/MiniGames/tests/puzzle-arena.html

브라우저 검사는 기존 형식 기록 보존, 정답·오답·힌트, 크기 변경, 언어 전환, 새로고침과 저장소 제한을 확인합니다. 검사 전의 관련 localStorage 값은 검사 후 복원합니다. 외부 테스트 라이브러리는 추가하지 않습니다.

## 빌드와 배포

~~~sh
npm run deploy
# 기존 진입점도 같은 전체 배포를 수행합니다.
npm --prefix sudoku-game run deploy
~~~

루트 predeploy가 Sudoku를 dist/sudoku-game/에 빌드하고, puzzle-arena/의 세 파일을 dist/puzzle-arena/로 복사한 뒤 dist/ 전체를 gh-pages에 배포합니다. Sudoku 폴더에서 실행하는 deploy도 루트 명령에 위임합니다. 생성된 dist/와 새 node_modules 캐시는 Git에서 제외합니다.

## 기록과 언어

기존 저장 키 akmaui-game-records-v1과 akmaui-game-language-v1, 기록 JSON 구조를 유지합니다. 같은 브라우저의 동일한 HTTPS 도메인에서는 블로그의 /games/puzzle-arena/에서 /MiniGames/puzzle-arena/로 경로가 바뀌어도 기록을 계속 읽습니다. file://나 다른 도메인·포트에 저장된 기록은 별도 저장 공간입니다.

게임에서 저장한 언어를 우선하고, 없으면 블로그의 i18nextLng를 초기 언어로 참고합니다. 이후 언어 선택은 게임 전용 키에 저장하며 블로그나 Sudoku의 선택을 덮어쓰지 않습니다.
