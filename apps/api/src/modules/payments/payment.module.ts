import { Module } from "@nestjs/common";
import { PaymentProviderFactory } from "./payment-provider.factory";
import { PaymentProviderHealthService } from "./payment-provider-health.service";
import { RazorpayProvider } from "./providers/razorpay.provider";
import { StripeProvider } from "./providers/stripe.provider";

@Module({
  providers: [StripeProvider, RazorpayProvider, PaymentProviderFactory, PaymentProviderHealthService],
  exports: [StripeProvider, RazorpayProvider, PaymentProviderFactory, PaymentProviderHealthService],
})
export class PaymentModule {}
