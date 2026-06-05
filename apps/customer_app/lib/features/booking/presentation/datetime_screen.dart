import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_typography.dart';
import '../../../providers/booking_provider.dart';

class DateTimeScreen extends ConsumerStatefulWidget {
  const DateTimeScreen({super.key});
  @override
  ConsumerState<DateTimeScreen> createState() => _DateTimeScreenState();
}

class _DateTimeScreenState extends ConsumerState<DateTimeScreen> {
  DateTime _date = DateTime.now();
  TimeOfDay _time = TimeOfDay(hour: TimeOfDay.now().hour + 1, minute: 0);
  bool _asap = false;

  DateTime get _dt => DateTime(_date.year, _date.month, _date.day, _time.hour, _time.minute);

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(title: const Text('Date & Time'), leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20), onPressed: () => context.pop())),
    body: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 16),
        Text('When do you need the ride?', style: AppTypography.heading2).animate().fadeIn(),
        const SizedBox(height: 24),

        _Option(selected: _asap, icon: Icons.bolt_rounded, title: 'As soon as possible', subtitle: "We'll find a driver immediately", onTap: () => setState(() => _asap = true)).animate(delay: 100.ms).fadeIn(),
        const SizedBox(height: 12),
        _Option(selected: !_asap, icon: Icons.schedule_rounded, title: 'Schedule for later', subtitle: 'Pick a date and time', onTap: () => setState(() => _asap = false)).animate(delay: 150.ms).fadeIn(),

        if (!_asap) ...[
          const SizedBox(height: 24),
          Text('Select Date', style: AppTypography.label).animate(delay: 200.ms).fadeIn(),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () async {
              final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 30)));
              if (d != null) setState(() => _date = d);
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Row(children: [const Icon(Icons.calendar_today_rounded, color: AppColors.accent, size: 20), const SizedBox(width: 12), Text(DateFormat('EEE, MMM d, yyyy').format(_date), style: AppTypography.bodyMedium), const Spacer(), const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted)]),
            ),
          ).animate(delay: 250.ms).fadeIn(),
          const SizedBox(height: 12),
          Text('Select Time', style: AppTypography.label).animate(delay: 300.ms).fadeIn(),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () async {
              final t = await showTimePicker(context: context, initialTime: _time);
              if (t != null) setState(() => _time = t);
            },
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
              child: Row(children: [const Icon(Icons.access_time_rounded, color: AppColors.accent, size: 20), const SizedBox(width: 12), Text(_time.format(context), style: AppTypography.bodyMedium), const Spacer(), const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted)]),
            ),
          ).animate(delay: 350.ms).fadeIn(),
        ],

        const Spacer(),

        SizedBox(
          width: double.infinity, height: 56,
          child: ElevatedButton(
            onPressed: () { ref.read(bookingProvider.notifier).setScheduledAt(_asap ? DateTime.now() : _dt); context.push('/flight-details'); },
            child: const Text('Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
        ).animate(delay: 400.ms).fadeIn(),
        const SizedBox(height: 16),
      ]),
    ),
  );
}

class _Option extends StatelessWidget {
  final bool selected; final IconData icon; final String title, subtitle; final VoidCallback onTap;
  const _Option({required this.selected, required this.icon, required this.title, required this.subtitle, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: selected ? AppColors.accentLight : AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: selected ? AppColors.accent : AppColors.border, width: selected ? 1.5 : 1),
      ),
      child: Row(children: [
        Icon(icon, color: selected ? AppColors.accent : AppColors.textMuted, size: 22),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: AppTypography.bodyMedium.copyWith(color: selected ? AppColors.accent : AppColors.textPrimary)),
          Text(subtitle, style: AppTypography.caption),
        ])),
        if (selected) const Icon(Icons.check_circle_rounded, color: AppColors.accent, size: 20),
      ]),
    ),
  );
}
