---
name: teacher-scheduler
description: 教師排課系統。自動化課程表生成工具，用於管理教師、教室、課程信息，自動分配課程到合適的教師、教室和時間段，檢測排課衝突，導出課程表。支持自動排課、手動分配、衝突檢測、統計分析、CSV/JSON導出。Keywords: 排課, 課程表, 教師排課, 自動排課, 課程分配, 時間表.
---

# 教師排課系統

自動化課程表生成工具，用於學校、培訓機構等教育機構的排課需求。

## 功能特性

- **教師管理**: 管理教師信息、教授科目、可用時間段
- **教室管理**: 管理教室資源、容量、可用時間段
- **課程管理**: 管理課程信息、班級、學生人數
- **自動排課**: 智能算法自動分配課程到合適的教師、教室和時間段
- **衝突檢測**: 自動檢測教師重複排課、教室衝突等問題
- **統計分析**: 生成排課統計、教師工作量分析
- **多格式導出**: 支持 CSV、JSON 格式導出

## 快速開始

### 1. 準備配置文件

創建 `schedule_config.json`:

```json
{
  "teachers": [
    {
      "id": "T001",
      "name": "王老師",
      "subjects": ["數學", "物理"],
      "available_slots": [
        {"day": "MONDAY", "start_time": "08:00", "end_time": "10:00"},
        {"day": "TUESDAY", "start_time": "08:00", "end_time": "10:00"}
      ],
      "max_hours_per_week": 20
    }
  ],
  "classrooms": [
    {
      "id": "C001",
      "name": "101教室",
      "capacity": 40,
      "available_slots": [
        {"day": "MONDAY", "start_time": "08:00", "end_time": "10:00"}
      ]
    }
  ],
  "courses": [
    {
      "id": "CRS001",
      "name": "高一數學",
      "subject": "數學",
      "class_name": "高一A班",
      "hours_per_week": 2,
      "student_count": 35
    }
  ]
}
```

### 2. 執行排課

```bash
python scripts/cli.py schedule_config.json schedule
```

### 3. 查看結果

```bash
# 顯示課程表
python scripts/cli.py schedule_config.json show

# 顯示衝突信息
python scripts/cli.py schedule_config.json conflicts

# 顯示統計信息
python scripts/cli.py schedule_config.json stats

# 導出為 CSV
python scripts/cli.py schedule_config.json export-csv schedule.csv

# 導出為 JSON
python scripts/cli.py schedule_config.json export-json schedule.json
```

## 核心概念

### 教師 (Teacher)
- **ID**: 唯一標識符
- **姓名**: 教師名稱
- **科目**: 能教授的科目列表
- **可用時間**: 教師可用的時間段列表
- **每週最多小時數**: 工作量限制（默認 20 小時）

### 教室 (Classroom)
- **ID**: 唯一標識符
- **名稱**: 教室名稱
- **容量**: 最多容納學生數
- **可用時間**: 教室可用的時間段列表

### 課程 (Course)
- **ID**: 唯一標識符
- **名稱**: 課程名稱
- **科目**: 課程科目（必須與教師的科目匹配）
- **班級**: 所屬班級
- **學生人數**: 班級人數（不能超過教室容量）
- **每週課時**: 每週上課小時數

### 時間段 (TimeSlot)
- **星期**: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
- **開始時間**: HH:MM 格式（如 08:00）
- **結束時間**: HH:MM 格式（如 10:00）

## 排課算法

系統使用貪心算法進行自動排課：

1. 遍歷所有未分配的課程
2. 對於每個課程：
   - 查找能教授該科目的教師
   - 查找容量足夠的教室
   - 查找教師和教室都可用的時間段
   - 分配課程到第一個可用的組合

## 衝突檢測

系統會自動檢測以下衝突類型：

| 衝突類型 | 描述 |
|---------|------|
| teacher_overlap | 教師在同一時間段有多個課程 |
| teacher_unavailable | 教師在該時間段不可用或無法教授該科目 |
| classroom_overlap | 教室在同一時間段被多個課程使用 |
| classroom_unavailable | 教室在該時間段不可用或容量不足 |

## Python API 使用

### 基本使用

```python
from scheduler_engine import SchedulingEngine, Teacher, Classroom, Course, TimeSlot, DayOfWeek

# 初始化引擎
engine = SchedulingEngine()

# 添加教師
teacher = Teacher(
    id='T001',
    name='王老師',
    subjects=['數學', '物理'],
    available_slots=[
        TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00'),
        TimeSlot(DayOfWeek.TUESDAY, '08:00', '10:00'),
    ]
)
engine.add_teacher(teacher)

# 添加教室
classroom = Classroom(
    id='C001',
    name='101教室',
    capacity=40,
    available_slots=[
        TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00'),
        TimeSlot(DayOfWeek.TUESDAY, '08:00', '10:00'),
    ]
)
engine.add_classroom(classroom)

# 添加課程
course = Course(
    id='CRS001',
    name='高一數學',
    subject='數學',
    class_name='高一A班',
    student_count=35
)
engine.add_course(course)

# 自動排課
success, fail = engine.auto_schedule()
print(f"成功: {success}, 失敗: {fail}")

# 導出
engine.export_to_csv('schedule.csv')
engine.export_to_json('schedule.json')
```

### 查詢功能

```python
# 查詢教師課程表
teacher_schedule = engine.get_teacher_schedule('T001')

# 查詢教室課程表
classroom_schedule = engine.get_classroom_schedule('C001')

# 查詢班級課程表
class_schedule = engine.get_class_schedule('高一A班')

# 獲取統計信息
stats = engine.get_statistics()
```

### 手動分配

```python
from scheduler_engine import TimeSlot, DayOfWeek

slot = TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00')
success = engine.assign_course('CRS001', 'T001', 'C001', slot)
```

## 配置文件格式

詳見 `references/usage_guide.md` 和 `assets/example_config.json`

## 最佳實踐

1. **充足的資源**: 確保教師和教室的可用時間足夠覆蓋所有課程
2. **合理的時間設置**: 避免過度限制教師和教室的可用時間
3. **檢查衝突**: 排課後檢查 `engine.conflicts` 列表
4. **迭代優化**: 根據衝突信息調整配置，重新排課
5. **人工審查**: 導出課程表後進行人工審查和調整

## 文件結構

```
teacher-scheduler/
├── SKILL.md                    # 本文件
├── scripts/
│   ├── scheduler_engine.py     # 核心排課引擎
│   └── cli.py                  # 命令行工具
├── references/
│   └── usage_guide.md          # 詳細使用指南
└── assets/
    └── example_config.json     # 示例配置文件
```

## 常見問題

### Q: 排課失敗的原因是什麼？
A: 檢查 `engine.conflicts` 列表，系統會詳細說明每個失敗的原因。常見原因包括：
- 沒有教師能教授該科目
- 教師在所有可用時間都已排滿
- 沒有足夠容量的教室
- 教室在所有可用時間都已被佔用

### Q: 如何手動調整課程分配？
A: 使用 `engine.assign_course()` 方法手動分配課程，或修改配置文件後重新排課。

### Q: 支持哪些導出格式？
A: 目前支持 CSV 和 JSON 格式。CSV 格式便於在 Excel 中查看，JSON 格式便於進一步處理。

### Q: 如何處理教師工作量限制？
A: 在教師配置中設置 `max_hours_per_week` 字段，系統會在排課時考慮此限制。

## 技術細節

- **語言**: Python 3.7+
- **依賴**: 無外部依賴，僅使用標準庫
- **算法**: 貪心算法
- **時間複雜度**: O(n*m*k)，其中 n 為課程數，m 為教師數，k 為時間段數

## 支持與反饋

如有問題或建議，請提供：
1. 配置文件
2. 錯誤信息或衝突列表
3. 期望的排課結果
