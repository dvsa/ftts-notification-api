export const globalDate = new Date('2000-03-02T22:30:45.979Z');
global.Date.now = jest.fn(() => globalDate.getTime());
