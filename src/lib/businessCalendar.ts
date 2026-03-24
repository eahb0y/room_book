import type { BusinessService, Room } from '@/types';

export interface BusinessCalendarStats {
  roomCalendars: number;
  serviceCalendars: number;
  totalCalendars: number;
}

export const countServiceCalendars = (services: BusinessService[]) =>
  services.reduce((total, service) => total + service.providers.length, 0);

export const getBusinessCalendarStats = (params: {
  rooms: Room[];
  services: BusinessService[];
}): BusinessCalendarStats => {
  const roomCalendars = params.rooms.length;
  const serviceCalendars = countServiceCalendars(params.services);

  return {
    roomCalendars,
    serviceCalendars,
    totalCalendars: roomCalendars + serviceCalendars,
  };
};
