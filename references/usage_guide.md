# 教師排課系統 - 使用指南

## 概述

教師排課系統是一個自動化的課程表生成工具，用於：
- 管理教師信息和可用時間
- 管理教室資源和容量
- 自動分配課程到合適的教師、教室和時間段
- 檢測和報告排課衝突
- 導出課程表為多種格式

## 核心概念

### 教師 (Teacher)
- **ID**: 唯一標識符
- **姓名**: 教師名稱
- **科目**: 能教授的科目列表
- **可用時間**: 教師可用的時間段列表
- **每週最多小時數**: 工作量限制

### 教室 (Classroom)
- **ID**: 唯一標識符
- **名稱**: 教室名稱
- **容量**: 最多容納學生數
- **可用時間**: 教室可用的時間段列表

### 課程 (Course)
- **ID**: 唯一標識符
- **名稱**: 課程名稱
- **科目**: 課程科目
- **班級**: 所屬班級
- **學生人數**: 班級人數
- **每週課時**: 每週上課小時數

### 時間段 (TimeSlot)
- **星期**: 星期一到星期日
- **開始時間**: HH:MM 格式
- **結束時間**: HH:MM 格式

## 排課流程

### 1. 初始化引擎
```python
from scheduler_engine import SchedulingEngine

engine = SchedulingEngine()
```

### 2. 添加教師
```python
from scheduler_engine import Teacher, TimeSlot, DayOfWeek

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
```

### 3. 添加教室
```python
from scheduler_engine import Classroom

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
```

### 4. 添加課程
```python
from scheduler_engine import Course

course = Course(
    id='CRS001',
    name='高一數學',
    subject='數學',
    class_name='高一A班',
    student_count=35
)
engine.add_course(course)
```

### 5. 自動排課
```python
success, fail = engine.auto_schedule()
print(f"成功: {success}, 失敗: {fail}")
```

### 6. 導出課程表
```python
# 導出為 CSV
engine.export_to_csv('schedule.csv')

# 導出為 JSON
engine.export_to_json('schedule.json')
```

## 衝突檢測

系統會自動檢測以下衝突：

1. **教師時間衝突** (teacher_overlap)
   - 教師在同一時間段有多個課程

2. **教師不可用** (teacher_unavailable)
   - 教師在該時間段不可用
   - 教師無法教授該科目

3. **教室時間衝突** (classroom_overlap)
   - 教室在同一時間段被多個課程使用

4. **教室不可用** (classroom_unavailable)
   - 教室在該時間段不可用
   - 教室容量不足

## 統計信息

```python
stats = engine.get_statistics()
# 返回:
# {
#     'total_courses': 10,
#     'scheduled_courses': 8,
#     'unscheduled_courses': 2,
#     'success_rate': '80.0%',
#     'total_conflicts': 2,
#     'teacher_hours': {'T001': 10, 'T002': 8}
# }
```

## 常見用途

### 查詢教師課程表
```python
teacher_schedule = engine.get_teacher_schedule('T001')
```

### 查詢教室課程表
```python
classroom_schedule = engine.get_classroom_schedule('C001')
```

### 查詢班級課程表
```python
class_schedule = engine.get_class_schedule('高一A班')
```

### 手動分配課程
```python
slot = TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00')
success = engine.assign_course('CRS001', 'T001', 'C001', slot)
```

## 最佳實踐

1. **確保充足的資源**: 教師和教室的可用時間應該足夠覆蓋所有課程
2. **合理設置可用時間**: 避免過度限制教師和教室的可用時間
3. **檢查衝突**: 排課後檢查 `engine.conflicts` 列表以了解失敗原因
4. **迭代優化**: 根據衝突信息調整教師或教室的可用時間，然後重新排課
5. **驗證結果**: 導出課程表後進行人工審查

## 導出格式

### CSV 格式
包含列: 課程ID, 課程名稱, 科目, 班級, 教師, 教室, 星期, 開始時間, 結束時間

### JSON 格式
結構化的課程信息，便於進一步處理或集成
