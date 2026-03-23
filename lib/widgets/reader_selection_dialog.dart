import 'package:flutter/material.dart';
import '../services/stripe_terminal_service.dart';

class ReaderSelectionDialog extends StatefulWidget {
  final Function(Map<String, dynamic>) onReaderSelected;

  const ReaderSelectionDialog({super.key, required this.onReaderSelected});

  @override
  State<ReaderSelectionDialog> createState() => _ReaderSelectionDialogState();
}

class _ReaderSelectionDialogState extends State<ReaderSelectionDialog> {
  List<Map<String, dynamic>> readers = [];
  bool isDiscovering = false;
  String? selectedReaderId;

  @override
  void initState() {
    super.initState();
    _discoverReaders();
  }

  Future<void> _discoverReaders() async {
    setState(() => isDiscovering = true);
    try {
      final discoveredReaders = await StripeTerminalService.discoverReaders();
      setState(() {
        readers = discoveredReaders;
        isDiscovering = false;
      });

      if (readers.isEmpty) {
        _showMessage(
          'No readers found. Make sure your reader is enabled and nearby.',
        );
      }
    } catch (e) {
      setState(() => isDiscovering = false);
      _showMessage('Error discovering readers: $e');
    }
  }

  Future<void> _connectReader(Map<String, dynamic> reader) async {
    try {
      await StripeTerminalService.connectReader(reader['id'] as String);
      widget.onReaderSelected(reader);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showMessage('Failed to connect: $e');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Select Payment Reader'),
      content: SizedBox(
        width: double.maxFinite,
        child: isDiscovering
            ? const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(),
                    SizedBox(height: 16),
                    Text('Searching for readers...'),
                  ],
                ),
              )
            : readers.isEmpty
            ? Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.devices_other, size: 48, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No readers found'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _discoverReaders,
                    child: const Text('Search Again'),
                  ),
                ],
              )
            : ListView.builder(
                shrinkWrap: true,
                itemCount: readers.length,
                itemBuilder: (context, index) {
                  final reader = readers[index];
                  return ListTile(
                    title: Text(reader['label'] as String? ?? 'Unknown'),
                    subtitle: Text(reader['serialNumber'] as String? ?? ''),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _connectReader(reader),
                  );
                },
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ],
    );
  }
}
