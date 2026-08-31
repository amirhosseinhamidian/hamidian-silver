-- Stage 076: keep completed return quantities covered by durable return allocation.
-- Prisma does not model this CHECK constraint in schema.prisma.

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_returned_within_allocation"
  CHECK ("returnedQuantity" <= "returnAllocatedQuantity");
