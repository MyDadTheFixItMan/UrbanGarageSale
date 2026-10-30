import 'package:flutter_test/flutter_test.dart';
import 'package:urban_garage_sale/models/sale.dart';

void main() {
  test('TapToPaySetup reads the API response', () {
    final setup = TapToPaySetup.fromJson({
      'success': true,
      'locationId': 'tml_123',
      'onBehalfOf': 'acct_456',
      'merchantDisplayName': 'Spring clear-out',
    });
    expect(setup.locationId, 'tml_123');
    expect(setup.onBehalfOf, 'acct_456');
    expect(setup.merchantDisplayName, 'Spring clear-out');
  });

  test('TapToPaySetup falls back to a generic display name', () {
    final setup = TapToPaySetup.fromJson({'locationId': 'tml_1', 'onBehalfOf': 'acct_1'});
    expect(setup.merchantDisplayName, 'Garage sale');
  });

  test('GarageSaleOption labels include the suburb when known', () {
    expect(GarageSaleOption.fromFirestore('a', {'title': 'Moving sale', 'suburb': 'Richmond'}).label,
        'Moving sale (Richmond)');
    expect(GarageSaleOption.fromFirestore('b', {'title': 'Moving sale'}).label, 'Moving sale');
    expect(GarageSaleOption.fromFirestore('c', {}).label, 'Garage sale');
  });
}
