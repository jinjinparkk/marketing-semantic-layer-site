# Marketing Semantic Layer — 프로젝트 소개 · 진행 상황

매체(Google · Meta · Naver)가 주장하는 광고 성과를 GA4 기록으로 검증하고,
지표 정의를 Semantic Layer 한 곳에 고정해 BI 와 AI 가 같은 숫자를 내게 하는 OKR 프로젝트의 공개 페이지입니다.
데이터는 전부 생성기로 만든 가상 데이터입니다 (가상 패션몰 "샘플패션", 2025-06-01 ~ 11-30).

| 페이지 | 주소 | 내용 |
|---|---|---|
| 📘 프로젝트 소개 | https://jinjinparkk.github.io/marketing-semantic-layer-site/ | 문제 · 해결 방법 · OKR, 전체 구조, **도구 선택 이유**(`#tools`), 데이터 시나리오, 데이터 모델링, 일정 |
| 📊 OKR 진행 상황 | https://jinjinparkk.github.io/marketing-semantic-layer-site/progress/ | 전체 · KR 진척, 계획 대비 진척 그래프, 회차별 작업, dbt 실무 활용 체크리스트, 주간 기록 |

두 페이지는 오른쪽 위 전환 버튼(📘 프로젝트 소개 / 📊 OKR 진행 상황)으로 오갑니다.

## OKR

- **Objective**: 매체마다 다르게 주장하는 광고 성과를 하나의 기준으로 검증하며, 마케팅 성과 측정에 대한 이해와 BI · AI 가 같은 숫자를 내는 데이터 파이프라인 구축 역량을 함께 갖춘다
- **KR1**: 마케팅 핵심 지표 10개 Semantic Layer 단일 정의 및 일일 자동 갱신 체계 구축
- **KR2**: AI 챗봇 · BI 대시보드 결과 일치율 100% 달성 (검증 질문 20개 기준)
- 기간: 2026-11-02 ~ 2027-01-29 · 매주 수요일 보고 · 최종 보고 2027-01-27

## 구조

```
생성기 (실제 API 응답 모양) → BigQuery (개발은 DuckDB) → dbt Core → Cube (Semantic Layer) → Metabase · AI 챗봇
                                    Airflow (매일 자동 실행) · GitHub Actions (CI)
```

도구별 후보 비교와 선택 이유는 소개 페이지의 "도구 선택 — 왜 이걸 골랐나" 에 있습니다.

## 이 저장소의 파일

| 파일 | 원본 (비공개 프로젝트 저장소) | 갱신 방법 |
|---|---|---|
| `index.html` | `site/index.html` | 원본을 고친 뒤 이 저장소에 복사 · 푸시 |
| `progress/index.html` | `progress/report.html` | 아래 스크립트 |
| `progress/common.js` · `style.css` | `progress/` 같은 이름 | 아래 스크립트 |
| `progress/progress.json` | `progress/progress.json` (진행 데이터) | 아래 스크립트 |

**진행 상황 갱신**: 프로젝트 저장소의 로컬 진행 웹(`progress/run_progress.bat` → http://localhost:8006/me.html)에서 작업을 체크 · 기록한 뒤
`progress/publish_report.bat` 을 실행하면 이 저장소의 `progress/` 로 복사 · 커밋 · 푸시합니다 (GitHub 계정 `jinjinparkk` 로 전환). 1분쯤 뒤 반영됩니다.

- 진행 상황 페이지는 로컬에선 `server.py` 의 `/api/progress` 를, 이 정적 사이트에선 같은 폴더의 `progress.json` 을 읽습니다 (`common.js` 의 `loadData`).
- 개인용 화면(`me.html`)과 서버(`server.py`)는 올리지 않습니다. 단 `progress.json` 은 통째로 공개되므로 작업 메모 · 주간 기록에 공개하면 안 되는 내용은 적지 않습니다.
- 소개 페이지와 진행 상황의 일부 문서는 Claude 가 작성했습니다 (프로젝트 저장소 README 의 "AI 작성 기록" 참고). dbt 모델은 직접 작성합니다.
