#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
教師排課系統 CLI 工具
Teacher Scheduling System CLI Tool
"""

import json
import sys
import io
from pathlib import Path
from scheduler_engine import (
    SchedulingEngine, Teacher, Classroom, Course, TimeSlot, DayOfWeek
)

# 設置 stdout 編碼
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def load_config(config_file: str) -> dict:
    """從 JSON 配置文件加載數據"""
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def setup_engine_from_config(engine: SchedulingEngine, config: dict) -> None:
    """從配置字典設置引擎"""
    # 添加教師
    for teacher_data in config.get('teachers', []):
        slots = [
            TimeSlot(
                day=DayOfWeek[slot['day']],
                start_time=slot['start_time'],
                end_time=slot['end_time']
            )
            for slot in teacher_data.get('available_slots', [])
        ]
        
        teacher = Teacher(
            id=teacher_data['id'],
            name=teacher_data['name'],
            subjects=teacher_data.get('subjects', []),
            available_slots=slots,
            max_hours_per_week=teacher_data.get('max_hours_per_week', 20)
        )
        engine.add_teacher(teacher)
    
    # 添加教室
    for classroom_data in config.get('classrooms', []):
        slots = [
            TimeSlot(
                day=DayOfWeek[slot['day']],
                start_time=slot['start_time'],
                end_time=slot['end_time']
            )
            for slot in classroom_data.get('available_slots', [])
        ]
        
        classroom = Classroom(
            id=classroom_data['id'],
            name=classroom_data['name'],
            capacity=classroom_data.get('capacity', 40),
            available_slots=slots
        )
        engine.add_classroom(classroom)
    
    # 添加課程
    for course_data in config.get('courses', []):
        course = Course(
            id=course_data['id'],
            name=course_data['name'],
            subject=course_data['subject'],
            class_name=course_data['class_name'],
            hours_per_week=course_data.get('hours_per_week', 2),
            student_count=course_data.get('student_count', 30)
        )
        engine.add_course(course)


def print_schedule(engine: SchedulingEngine) -> None:
    """打印課程表"""
    print("\n" + "="*80)
    print("課程表")
    print("="*80)
    
    if not engine.schedule:
        print("沒有已排課程")
        return
    
    print(f"{'課程ID':<10} {'課程名稱':<15} {'科目':<10} {'班級':<10} {'教師':<10} {'教室':<10} {'星期':<10} {'時間':<15}")
    print("-"*80)
    
    for course in engine.schedule:
        if course.slot:
            teacher_name = engine.teachers[course.teacher_id].name if course.teacher_id else ''
            classroom_name = engine.classrooms[course.classroom_id].name if course.classroom_id else ''
            time_str = f"{course.slot.start_time}-{course.slot.end_time}"
            
            print(f"{course.id:<10} {course.name:<15} {course.subject:<10} {course.class_name:<10} {teacher_name:<10} {classroom_name:<10} {course.slot.day.name:<10} {time_str:<15}")


def print_conflicts(engine: SchedulingEngine) -> None:
    """打印衝突信息"""
    if not engine.conflicts:
        print("\n沒有衝突")
        return
    
    print("\n" + "="*80)
    print("衝突信息")
    print("="*80)
    
    for conflict in engine.conflicts:
        print(f"[{conflict.type}] {conflict.course_id}: {conflict.message}")


def print_statistics(engine: SchedulingEngine) -> None:
    """打印統計信息"""
    stats = engine.get_statistics()
    
    print("\n" + "="*80)
    print("統計信息")
    print("="*80)
    print(f"總課程數: {stats['total_courses']}")
    print(f"已排課程: {stats['scheduled_courses']}")
    print(f"未排課程: {stats['unscheduled_courses']}")
    print(f"成功率: {stats['success_rate']}")
    print(f"衝突數: {stats['total_conflicts']}")
    
    if stats['teacher_hours']:
        print("\n教師工作量:")
        for teacher_id, hours in stats['teacher_hours'].items():
            teacher = engine.teachers.get(teacher_id)
            if teacher:
                print(f"  {teacher.name}: {hours} 小時/週")


def print_teacher_schedule(engine: SchedulingEngine, teacher_id: str) -> None:
    """打印教師課程表"""
    teacher = engine.teachers.get(teacher_id)
    if not teacher:
        print(f"教師 {teacher_id} 不存在")
        return
    
    schedule = engine.get_teacher_schedule(teacher_id)
    
    print(f"\n{teacher.name} 的課程表:")
    print("-"*60)
    
    if not schedule:
        print("沒有課程")
        return
    
    for course in schedule:
        if course.slot:
            print(f"  {course.slot.day.name} {course.slot.start_time}-{course.slot.end_time}: {course.name} ({course.class_name})")


def main():
    """主函數"""
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python cli.py <config_file> [command]")
        print("\n命令:")
        print("  schedule    - 執行自動排課")
        print("  show        - 顯示課程表")
        print("  conflicts   - 顯示衝突信息")
        print("  stats       - 顯示統計信息")
        print("  teacher <id> - 顯示教師課程表")
        print("  export-csv <output_file> - 導出為 CSV")
        print("  export-json <output_file> - 導出為 JSON")
        return
    
    config_file = sys.argv[1]
    command = sys.argv[2] if len(sys.argv) > 2 else 'schedule'
    
    # 加載配置
    try:
        config = load_config(config_file)
    except FileNotFoundError:
        print(f"配置文件不存在: {config_file}")
        return
    except json.JSONDecodeError:
        print(f"配置文件格式錯誤: {config_file}")
        return
    
    # 初始化引擎
    engine = SchedulingEngine()
    setup_engine_from_config(engine, config)
    
    # 執行命令
    if command == 'schedule':
        print("正在執行自動排課...")
        success, fail = engine.auto_schedule()
        print(f"排課完成: 成功 {success}, 失敗 {fail}")
        print_schedule(engine)
        print_conflicts(engine)
        print_statistics(engine)
    
    elif command == 'show':
        print_schedule(engine)
    
    elif command == 'conflicts':
        print_conflicts(engine)
    
    elif command == 'stats':
        print_statistics(engine)
    
    elif command == 'teacher' and len(sys.argv) > 3:
        teacher_id = sys.argv[3]
        print_teacher_schedule(engine, teacher_id)
    
    elif command == 'export-csv' and len(sys.argv) > 3:
        output_file = sys.argv[3]
        engine.auto_schedule()
        engine.export_to_csv(output_file)
        print(f"已導出到 {output_file}")
    
    elif command == 'export-json' and len(sys.argv) > 3:
        output_file = sys.argv[3]
        engine.auto_schedule()
        engine.export_to_json(output_file)
        print(f"已導出到 {output_file}")
    
    else:
        print(f"未知命令: {command}")


if __name__ == '__main__':
    main()
