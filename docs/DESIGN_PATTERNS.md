# HARNESS MES 페이지 디자인 패턴

> 기준 페이지: `/master/equip` (EquipMasterPage)

---

## 패턴 1: 페이지 헤더 (Page Header)

상단 타이틀 행에 **페이지 제목 + 설명** (좌측)과 **액션 버튼** (우측)을 배치한다.

```tsx
<div className="flex justify-between items-center">
  {/* 좌측: 타이틀 + 설명 */}
  <div>
    <h1 className="text-xl font-bold text-text flex items-center gap-2">
      <아이콘 className="w-7 h-7 text-primary" />
      페이지 제목
    </h1>
    <p className="text-text-muted mt-1">페이지 설명 텍스트</p>
  </div>

  {/* 우측: 액션 버튼들 */}
  <div className="flex gap-2">
    <Button variant="secondary" size="sm">
      <Download className="w-4 h-4 mr-1" />엑셀
    </Button>
    <Button size="sm" onClick={handleAdd}>
      <Plus className="w-4 h-4 mr-1" />추가
    </Button>
  </div>
</div>
```

### 규칙
- **h1에 아이콘 필수**: 각 페이지별 대표 lucide 아이콘 사용
- **버튼 배치**: 해당 페이지에 맞는 기능 버튼 배치
  - 조회 페이지: `엑셀 다운로드` + `새로고침`
  - CRUD 페이지: `엑셀 다운로드` + `추가` (primary)
  - 상태 관리 페이지: `엑셀 다운로드` + `새로고침` + 해당 기능 버튼
- **secondary 버튼**: 엑셀, 새로고침 등 보조 기능
- **primary 버튼**: 추가, 등록 등 주요 기능

---

## 패턴 2: 검색/필터 + 데이터 그리드 (Filter & Grid)

**검색과 필터는 데이터 Card 내부**에 위치하며, DataGrid 바로 위에 배치한다.
별도 Card로 분리하지 않는다. CardHeader도 사용하지 않는다.

```tsx
<Card>
  <CardContent>
    {/* 필터 행 */}
    <div className="flex flex-wrap gap-4 mb-4">
      {/* 검색 입력 (flex-1) */}
      <div className="flex-1 min-w-[200px]">
        <Input
          placeholder="검색어..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
      </div>

      {/* 셀렉트 필터들 */}
      <Select options={options} value={filter} onChange={setFilter} placeholder="필터명" />

      {/* 날짜 범위 (필요시) */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-text-muted" />
        <Input type="date" value={startDate} onChange={...} className="w-36" />
        <span className="text-text-muted">~</span>
        <Input type="date" value={endDate} onChange={...} className="w-36" />
      </div>

      {/* 새로고침 버튼 */}
      <Button variant="secondary">
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>

    {/* 데이터 그리드 */}
    <DataGrid data={filteredData} columns={columns} pageSize={10} />
  </CardContent>
</Card>
```

### 규칙
- **CardHeader 사용 금지**: 데이터 그리드 Card에는 CardHeader를 사용하지 않음
- **별도 필터 Card 금지**: 필터를 별도 Card로 분리하지 않음
- **검색 입력**: `flex-1 min-w-[200px]`으로 가변 너비
- **필터 순서**: 검색 > 셀렉트 필터 > 날짜 > 새로고침 버튼
- **mb-4**: 필터와 그리드 사이 간격

---

## 패턴 3: 통계 카드 (StatCard) - 선택적

StatCard가 필요한 페이지에서는 헤더와 메인 Card 사이에 배치한다.

```tsx
{/* 통계 카드 */}
<div className="grid grid-cols-4 gap-3">
  <StatCard label="라벨" value={값} icon={아이콘} color="blue" />
  <StatCard label="라벨" value={값} icon={아이콘} color="green" />
  <StatCard label="라벨" value={값} icon={아이콘} color="red" />
  <StatCard label="라벨" value={값} icon={아이콘} color="purple" />
</div>
```

### 규칙
- `grid grid-cols-4 gap-3` 기본 (5개일 경우 `grid-cols-2 md:grid-cols-5`)
- 마스터 CRUD 페이지에는 StatCard 불필요
- 조회/현황 페이지에서 사용

---

## 패턴 4: 전체 페이지 구조

```tsx
<div className="space-y-6 animate-fade-in">
  {/* 1. 페이지 헤더 (패턴 1) */}

  {/* 2. 통계 카드 (패턴 3, 선택적) */}

  {/* 3. 검색/필터 + 데이터 그리드 (패턴 2) */}

  {/* 4. 모달 (하단에 배치) */}
</div>
```

---

## 페이지별 아이콘 매핑

| 페이지 | 아이콘 | 비고 |
|--------|--------|------|
| 설비마스터 | Monitor | |
| 품목마스터 | Package | |
| 공통코드 | Settings | |
| BOM | Layers | |
| 작업지시 | ClipboardList | |
| 생산실적 | Factory | |
| 절단 작업지시 | Scissors | |
| 압착 작업지시 | Hammer | |
| 불량관리 | AlertTriangle | |
| 검사실적 | Activity | |
| 추적성조회 | History | |
| 출고관리 | ArrowRightFromLine | |
| 입하/IQC | Package | |
| 재고현황 | Warehouse | |
| 포장관리 | Package | |
| 팔레트적재 | Layers | |
| 출하확정 | Truck | |
| 설비 가동현황 | Monitor | |
