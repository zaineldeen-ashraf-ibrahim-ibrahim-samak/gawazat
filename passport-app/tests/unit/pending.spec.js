const { expect } = require('chai');
const { createPendingHandlers } = require('../../src/main/ipc/pendingHandlers');

describe('Pending Approval Logic', () => {
  let store;
  let handlers;

  beforeEach(() => {
    store = {
      getState: () => ({
        manifest: [],
        boarding_records: {},
        pending_approval: [
          { id: 'p1', state: 'awaiting', passport_number_normalized: 'AB123456', mrz_fields: { name: 'John Doe' } }
        ],
        scan_events: []
      }),
      mutate: (fn) => {
        const draft = store.getState();
        fn(draft);
        // In a real store, this would save
      }
    };
    handlers = createPendingHandlers(store);
  });

  it('should list only awaiting entries', async () => {
    const list = await handlers.list();
    expect(list).to.have.lengthOf(1);
    expect(list[0].id).to.equal('p1');
  });

  // More tests would go here
});
