#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
教師排課系統核心引擎
Teacher Scheduling System Core Engine
"""

import json
from datetime import datetime, time, timedelta
from typing import List, Dict, Set, Tuple, Optional
from dataclasses import dataclass, asdict, field
from enum import Enum
import csv
from pathlib import Path


class DayOfWeek(Enum):
    """星期"""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


@dataclass
class TimeSlot:
    """時間段"""
    day: DayOfWeek
    start_time: str  # HH:MM format
    end_time: str    # HH:MM format
    
    def __hash__(self):
        return hash((self.day.value, self.start_time, self.end_time))
    
    def __eq__(self, other):
        if not isinstance(other, TimeSlot):
            return False
        return (self.day == other.day and 
                self.start_time == other.start_time and 
                self.end_time == other.end_time)
    
    def overlaps_with(self, other: 'TimeSlot') -> bool:
        """檢查是否與另一個時間段重疊"""
        if self.day != other.day:
            return False
        
        self_start = datetime.strptime(self.start_time, "%H:%M").time()
        self_end = datetime.strptime(self.end_time, "%H:%M").time()
        other_start = datetime.strptime(other.start_time, "%H:%M").time()
        other_end = datetime.strptime(other.end_time, "%H:%M").time()
        
        return not (self_end <= other_start or self_start >= other_end)


@dataclass
class Teacher:
    """教師"""
    id: str
    name: str
    subjects: List[str]  # 教授科目
    available_slots: List[TimeSlot]  # 可用時間段
    max_hours_per_week: int = 20  # 每週最多小時數
    
    def can_teach(self, subject: str) -> bool:
        """檢查是否能教授該科目"""
        return subject in self.subjects
    
    def is_available(self, slot: TimeSlot) -> bool:
        """檢查是否在該時間段可用"""
        return slot in self.available_slots


@dataclass
class Classroom:
    """教室"""
    id: str
    name: str
    capacity: int
    available_slots: List[TimeSlot]  # 可用時間段


@dataclass
class Course:
    """課程"""
    id: str
    name: str
    subject: str
    class_name: str  # 班級名稱
    teacher_id: Optional[str] = None  # 分配的教師
    classroom_id: Optional[str] = None  # 分配的教室
    slot: Optional[TimeSlot] = None  # 分配的時間段
    hours_per_week: int = 2  # 每週課時
    student_count: int = 30  # 學生人數


@dataclass
class ScheduleConflict:
    """排課衝突"""
    type: str  # 'teacher_overlap', 'classroom_overlap', 'teacher_unavailable', 'classroom_unavailable'
    course_id: str
    message: str


class SchedulingEngine:
    """排課引擎"""
    
    def __init__(self):
        self.teachers: Dict[str, Teacher] = {}
        self.classrooms: Dict[str, Classroom] = {}
        self.courses: Dict[str, Course] = {}
        self.schedule: List[Course] = []
        self.conflicts: List[ScheduleConflict] = []
    
    def add_teacher(self, teacher: Teacher) -> None:
        """添加教師"""
        self.teachers[teacher.id] = teacher
    
    def add_classroom(self, classroom: Classroom) -> None:
        """添加教室"""
        self.classrooms[classroom.id] = classroom
    
    def add_course(self, course: Course) -> None:
        """添加課程"""
        self.courses[course.id] = course
    
    def get_teacher_schedule(self, teacher_id: str) -> List[Course]:
        """獲取教師的課程表"""
        return [c for c in self.schedule if c.teacher_id == teacher_id]
    
    def get_classroom_schedule(self, classroom_id: str) -> List[Course]:
        """獲取教室的課程表"""
        return [c for c in self.schedule if c.classroom_id == classroom_id]
    
    def get_class_schedule(self, class_name: str) -> List[Course]:
        """獲取班級的課程表"""
        return [c for c in self.schedule if c.class_name == class_name]
    
    def check_teacher_conflict(self, course: Course, slot: TimeSlot) -> Optional[ScheduleConflict]:
        """檢查教師是否有時間衝突"""
        if not course.teacher_id:
            return None
        
        teacher = self.teachers.get(course.teacher_id)
        if not teacher:
            return ScheduleConflict(
                type='teacher_unavailable',
                course_id=course.id,
                message=f"教師 {course.teacher_id} 不存在"
            )
        
        # 檢查教師是否可用
        if not teacher.is_available(slot):
            return ScheduleConflict(
                type='teacher_unavailable',
                course_id=course.id,
                message=f"教師 {teacher.name} 在 {slot.day.name} {slot.start_time}-{slot.end_time} 不可用"
            )
        
        # 檢查教師是否有重複排課
        for scheduled_course in self.get_teacher_schedule(course.teacher_id):
            if scheduled_course.slot and scheduled_course.slot.overlaps_with(slot):
                return ScheduleConflict(
                    type='teacher_overlap',
                    course_id=course.id,
                    message=f"教師 {teacher.name} 在 {slot.day.name} {slot.start_time}-{slot.end_time} 已有課程"
                )
        
        return None
    
    def check_classroom_conflict(self, course: Course, slot: TimeSlot) -> Optional[ScheduleConflict]:
        """檢查教室是否有衝突"""
        if not course.classroom_id:
            return None
        
        classroom = self.classrooms.get(course.classroom_id)
        if not classroom:
            return ScheduleConflict(
                type='classroom_unavailable',
                course_id=course.id,
                message=f"教室 {course.classroom_id} 不存在"
            )
        
        # 檢查教室是否可用
        if slot not in classroom.available_slots:
            return ScheduleConflict(
                type='classroom_unavailable',
                course_id=course.id,
                message=f"教室 {classroom.name} 在 {slot.day.name} {slot.start_time}-{slot.end_time} 不可用"
            )
        
        # 檢查教室是否有重複排課
        for scheduled_course in self.get_classroom_schedule(course.classroom_id):
            if scheduled_course.slot and scheduled_course.slot.overlaps_with(slot):
                return ScheduleConflict(
                    type='classroom_overlap',
                    course_id=course.id,
                    message=f"教室 {classroom.name} 在 {slot.day.name} {slot.start_time}-{slot.end_time} 已被佔用"
                )
        
        return None
    
    def assign_course(self, course_id: str, teacher_id: str, classroom_id: str, slot: TimeSlot) -> bool:
        """分配課程"""
        course = self.courses.get(course_id)
        if not course:
            return False
        
        # 檢查教師是否能教授該科目
        teacher = self.teachers.get(teacher_id)
        if not teacher or not teacher.can_teach(course.subject):
            self.conflicts.append(ScheduleConflict(
                type='teacher_unavailable',
                course_id=course_id,
                message=f"教師 {teacher_id} 無法教授 {course.subject}"
            ))
            return False
        
        # 檢查衝突
        teacher_conflict = self.check_teacher_conflict(course, slot)
        if teacher_conflict:
            self.conflicts.append(teacher_conflict)
            return False
        
        classroom_conflict = self.check_classroom_conflict(course, slot)
        if classroom_conflict:
            self.conflicts.append(classroom_conflict)
            return False
        
        # 分配課程
        course.teacher_id = teacher_id
        course.classroom_id = classroom_id
        course.slot = slot
        self.schedule.append(course)
        
        return True
    
    def auto_schedule(self) -> Tuple[int, int]:
        """自動排課
        
        Returns:
            (成功數, 失敗數)
        """
        success_count = 0
        fail_count = 0
        
        for course in self.courses.values():
            if course.teacher_id:  # 已分配
                continue
            
            # 尋找合適的教師
            suitable_teachers = [
                t for t in self.teachers.values()
                if t.can_teach(course.subject)
            ]
            
            if not suitable_teachers:
                self.conflicts.append(ScheduleConflict(
                    type='teacher_unavailable',
                    course_id=course.id,
                    message=f"沒有教師能教授 {course.subject}"
                ))
                fail_count += 1
                continue
            
            # 尋找合適的教室
            suitable_classrooms = [
                c for c in self.classrooms.values()
                if c.capacity >= course.student_count
            ]
            
            if not suitable_classrooms:
                self.conflicts.append(ScheduleConflict(
                    type='classroom_unavailable',
                    course_id=course.id,
                    message=f"沒有足夠容量的教室"
                ))
                fail_count += 1
                continue
            
            # 尋找合適的時間段
            assigned = False
            for teacher in suitable_teachers:
                for slot in teacher.available_slots:
                    for classroom in suitable_classrooms:
                        if slot in classroom.available_slots:
                            if self.assign_course(course.id, teacher.id, classroom.id, slot):
                                success_count += 1
                                assigned = True
                                break
                    if assigned:
                        break
                if assigned:
                    break
            
            if not assigned:
                fail_count += 1
        
        return success_count, fail_count
    
    def export_to_csv(self, filename: str) -> None:
        """導出課程表為 CSV"""
        with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['課程ID', '課程名稱', '科目', '班級', '教師', '教室', '星期', '開始時間', '結束時間'])
            
            for course in self.schedule:
                if course.slot:
                    writer.writerow([
                        course.id,
                        course.name,
                        course.subject,
                        course.class_name,
                        self.teachers[course.teacher_id].name if course.teacher_id else '',
                        self.classrooms[course.classroom_id].name if course.classroom_id else '',
                        course.slot.day.name,
                        course.slot.start_time,
                        course.slot.end_time
                    ])
    
    def export_to_json(self, filename: str) -> None:
        """導出課程表為 JSON"""
        schedule_data = []
        for course in self.schedule:
            if course.slot:
                schedule_data.append({
                    'course_id': course.id,
                    'course_name': course.name,
                    'subject': course.subject,
                    'class_name': course.class_name,
                    'teacher': self.teachers[course.teacher_id].name if course.teacher_id else None,
                    'classroom': self.classrooms[course.classroom_id].name if course.classroom_id else None,
                    'day': course.slot.day.name,
                    'start_time': course.slot.start_time,
                    'end_time': course.slot.end_time
                })
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(schedule_data, f, ensure_ascii=False, indent=2)
    
    def get_statistics(self) -> Dict:
        """獲取排課統計"""
        total_courses = len(self.courses)
        scheduled_courses = len(self.schedule)
        unscheduled_courses = total_courses - scheduled_courses
        
        teacher_hours = {}
        for course in self.schedule:
            if course.teacher_id:
                if course.teacher_id not in teacher_hours:
                    teacher_hours[course.teacher_id] = 0
                teacher_hours[course.teacher_id] += course.hours_per_week
        
        return {
            'total_courses': total_courses,
            'scheduled_courses': scheduled_courses,
            'unscheduled_courses': unscheduled_courses,
            'success_rate': f"{(scheduled_courses / total_courses * 100):.1f}%" if total_courses > 0 else "0%",
            'total_conflicts': len(self.conflicts),
            'teacher_hours': teacher_hours
        }


def main():
    """示例使用"""
    engine = SchedulingEngine()
    
    # 添加教師
    teacher1 = Teacher(
        id='T001',
        name='王老師',
        subjects=['數學', '物理'],
        available_slots=[
            TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00'),
            TimeSlot(DayOfWeek.TUESDAY, '08:00', '10:00'),
            TimeSlot(DayOfWeek.WEDNESDAY, '08:00', '10:00'),
        ]
    )
    
    teacher2 = Teacher(
        id='T002',
        name='李老師',
        subjects=['英語', '語文'],
        available_slots=[
            TimeSlot(DayOfWeek.MONDAY, '10:00', '12:00'),
            TimeSlot(DayOfWeek.TUESDAY, '10:00', '12:00'),
            TimeSlot(DayOfWeek.THURSDAY, '08:00', '10:00'),
        ]
    )
    
    engine.add_teacher(teacher1)
    engine.add_teacher(teacher2)
    
    # 添加教室
    classroom1 = Classroom(
        id='C001',
        name='101教室',
        capacity=40,
        available_slots=[
            TimeSlot(DayOfWeek.MONDAY, '08:00', '10:00'),
            TimeSlot(DayOfWeek.TUESDAY, '08:00', '10:00'),
            TimeSlot(DayOfWeek.WEDNESDAY, '08:00', '10:00'),
            TimeSlot(DayOfWeek.MONDAY, '10:00', '12:00'),
            TimeSlot(DayOfWeek.TUESDAY, '10:00', '12:00'),
            TimeSlot(DayOfWeek.THURSDAY, '08:00', '10:00'),
        ]
    )
    
    engine.add_classroom(classroom1)
    
    # 添加課程
    course1 = Course(
        id='CRS001',
        name='高一數學',
        subject='數學',
        class_name='高一A班',
        student_count=35
    )
    
    course2 = Course(
        id='CRS002',
        name='高一英語',
        subject='英語',
        class_name='高一A班',
        student_count=35
    )
    
    engine.add_course(course1)
    engine.add_course(course2)
    
    # 自動排課
    success, fail = engine.auto_schedule()
    print(f"排課結果: 成功 {success}, 失敗 {fail}")
    
    # 獲取統計
    stats = engine.get_statistics()
    print(f"統計: {stats}")
    
    # 導出
    engine.export_to_csv('schedule.csv')
    engine.export_to_json('schedule.json')
    print("已導出課程表")


if __name__ == '__main__':
    main()
