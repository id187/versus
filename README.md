# VERSUS Web

VERSUS의 공개 웹 배포 저장소입니다. 게임 데이터와 웹 전투 엔진의 원본은 `VERSUS-DEV`에서 관리하며, 이 저장소는 `sync-release.ps1 -Target Git -Apply -Prune`으로 갱신합니다.

GitHub Pages가 `web/`과 `dataset/`을 정적 웹게임으로 조립하여 배포합니다. 별도의 Node.js 서버는 필요하지 않습니다.

## 웹 주소

<https://id187.github.io/versus/>

## 배포

`main` 브랜치에 변경 사항이 올라오면 GitHub Actions가 자동으로 Pages 배포를 실행합니다.

## 구성

```text
dataset/             게임 데이터
web/                 브라우저 UI와 전투 엔진
.github/workflows/   GitHub Pages 자동 배포
```

PvE와 Adventure는 각 브라우저 안에서 실행됩니다. PvP는 `dataset/firebase.json`에 설정된 Firebase Realtime Database를 사용합니다.
